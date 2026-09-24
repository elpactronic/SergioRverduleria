"use server";

import { and, desc, eq, inArray, max } from "drizzle-orm";
import { getDb } from "@/db";
import {
  pedidos,
  pedidoItems,
  movimientosStock,
  cobros,
  clientes,
} from "@/db/schema";
import { registrarAuditoria } from "./audit";
import { verificarPinConLimite } from "./configuracion";

export interface PedidoItemSync {
  productoId: string;
  detalle: string;
  cantidadBultos: string;
  precioUnitario: string;
  total: string;
  origen: "mostrador" | "deposito";
}

export interface PedidoSync {
  id: string;
  numeroPedido: number;
  fecha: string;
  clienteId: string | null;
  vendedorId: string;
  dispositivoId?: string;
  items: PedidoItemSync[];
  total: string;
  creadoEn: string;
}

/** Devuelve el mayor número de pedido ya confirmado en el servidor para una fecha, para reconciliar el contador local. */
export async function obtenerUltimoNumeroPedido(fecha: string) {
  const db = getDb();
  const [fila] = await db
    .select({ max: max(pedidos.numeroPedido) })
    .from(pedidos)
    .where(eq(pedidos.fecha, fecha));
  return fila?.max ?? 0;
}

/** Lista los pedidos más recientes (todos los dispositivos), para mostrar en caja/vendedor. */
export async function listarPedidosRecientes(limite = 5) {
  const db = getDb();
  const filas = await db
    .select({
      id: pedidos.id,
      numeroPedido: pedidos.numeroPedido,
      fecha: pedidos.fecha,
      clienteNombre: clientes.nombre,
      total: pedidos.total,
      estado: pedidos.estado,
      creadoEn: pedidos.creadoEn,
    })
    .from(pedidos)
    .leftJoin(clientes, eq(pedidos.clienteId, clientes.id))
    .orderBy(desc(pedidos.creadoEn))
    .limit(limite);

  return filas;
}

/**
 * Lista los pedidos ya pagados más recientes (cobrados y/o ya retirados),
 * ordenados por cuándo se cobraron. Sirve como bandeja de "para entregar"
 * y a la vez como registro de cuándo se retiró cada uno.
 */
export async function listarPedidosPagadosRecientes(limite = 5) {
  const db = getDb();
  const filas = await db
    .select({
      id: pedidos.id,
      numeroPedido: pedidos.numeroPedido,
      fecha: pedidos.fecha,
      clienteNombre: clientes.nombre,
      total: pedidos.total,
      estado: pedidos.estado,
      cobradoEn: cobros.registradoEn,
      retiradoEn: pedidos.retiradoEn,
    })
    .from(pedidos)
    .innerJoin(cobros, eq(cobros.pedidoId, pedidos.id))
    .leftJoin(clientes, eq(pedidos.clienteId, clientes.id))
    .where(inArray(pedidos.estado, ["cobrado", "retirado"]))
    .orderBy(desc(cobros.registradoEn))
    .limit(limite);

  return filas;
}

/** Marca un pedido como retirado por el cliente, con timestamp exacto para cruzar con cámaras. */
export async function marcarRetirado(params: {
  pedidoId: string;
  usuario: string;
  dispositivo?: string;
}) {
  const db = getDb();
  const anterior = await db.query.pedidos.findFirst({
    where: eq(pedidos.id, params.pedidoId),
  });

  const [actualizado] = await db
    .update(pedidos)
    .set({ estado: "retirado", retiradoEn: new Date() })
    .where(eq(pedidos.id, params.pedidoId))
    .returning();

  await registrarAuditoria({
    operationId: crypto.randomUUID(),
    usuario: params.usuario,
    dispositivo: params.dispositivo,
    accion: "RETIRAR_PEDIDO",
    entidad: "pedido",
    entidadId: params.pedidoId,
    numeroPedido: actualizado.numeroPedido,
    estadoAnterior: anterior,
    estadoNuevo: actualizado,
  });

  return actualizado;
}

/** Trae un pedido con sus ítems y el nombre del cliente, para la pantalla de confirmación de cobro. */
export async function obtenerDetallePedido(pedidoId: string) {
  const db = getDb();
  const pedido = await db.query.pedidos.findFirst({
    where: eq(pedidos.id, pedidoId),
  });
  if (!pedido) return null;

  const [cliente, items] = await Promise.all([
    pedido.clienteId
      ? db.query.clientes.findFirst({ where: eq(clientes.id, pedido.clienteId) })
      : Promise.resolve(null),
    db.query.pedidoItems.findMany({ where: eq(pedidoItems.pedidoId, pedidoId) }),
  ]);

  return {
    ...pedido,
    clienteNombre: cliente?.nombre ?? "Consumidor final",
    items,
  };
}

/**
 * Sincroniza un pedido creado offline. Idempotente por UUID: si ya existe
 * (reintento de sync) no lo duplica. Si el producto es de stock controlado,
 * genera el movimiento de salida correspondiente.
 */
export async function sincronizarPedido(pedido: PedidoSync) {
  const db = getDb();

  const existente = await db.query.pedidos.findFirst({
    where: eq(pedidos.id, pedido.id),
  });
  if (existente) {
    return { ok: true as const, yaExistia: true, pedidoId: existente.id };
  }

  const [creado] = await db
    .insert(pedidos)
    .values({
      id: pedido.id,
      numeroPedido: pedido.numeroPedido,
      fecha: pedido.fecha,
      clienteId: pedido.clienteId,
      vendedorId: pedido.vendedorId,
      dispositivoId: pedido.dispositivoId,
      estado: "creado",
      total: pedido.total,
      creadoEn: new Date(pedido.creadoEn),
    })
    .returning();

  if (pedido.items.length > 0) {
    await db.insert(pedidoItems).values(
      pedido.items.map((item) => ({
        pedidoId: creado.id,
        productoId: item.productoId,
        detalle: item.detalle,
        cantidadBultos: item.cantidadBultos,
        precioUnitario: item.precioUnitario,
        total: item.total,
        origen: item.origen,
      })),
    );
  }

  await registrarAuditoria({
    operationId: crypto.randomUUID(),
    usuario: pedido.vendedorId,
    dispositivo: pedido.dispositivoId,
    accion: "CREAR_PEDIDO",
    entidad: "pedido",
    entidadId: creado.id,
    numeroPedido: creado.numeroPedido,
    estadoNuevo: creado,
  });

  // Ya cobrado offline antes de sincronizar el pedido: conciliar cobros huérfanos.
  await conciliarCobrosPendientesDe(pedido.fecha, pedido.numeroPedido, creado.id);

  return { ok: true as const, yaExistia: false, pedidoId: creado.id };
}

async function conciliarCobrosPendientesDe(
  fecha: string,
  numeroPedido: number,
  pedidoId: string,
) {
  const db = getDb();
  const huerfanos = await db.query.cobros.findMany({
    where: and(
      eq(cobros.pedidoFecha, fecha),
      eq(cobros.pedidoNumero, numeroPedido),
    ),
  });

  for (const cobro of huerfanos.filter((c) => c.pedidoId === null && c.estado !== "cancelado")) {
    await conciliarCobro(cobro.id, pedidoId);
  }
}

export async function conciliarCobro(cobroId: string, pedidoId: string) {
  const db = getDb();

  const pedidoAntes = await db.query.pedidos.findFirst({ where: eq(pedidos.id, pedidoId) });
  if (!pedidoAntes) {
    throw new Error("El pedido no existe.");
  }

  const [cobroActualizado] = await db
    .update(cobros)
    .set({ pedidoId, estado: "conciliado" })
    .where(eq(cobros.id, cobroId))
    .returning();

  if (pedidoAntes.estado !== "creado") {
    // Idempotente: este pedido ya habia sido conciliado antes (doble clic,
    // doble sincronizacion, dos cobros para el mismo numero). Se deja el
    // cobro vinculado para que no quede huerfano, pero NO se vuelve a
    // descontar stock ni a duplicar la autorizacion de retiro.
    await registrarAuditoria({
      operationId: crypto.randomUUID(),
      usuario: cobroActualizado.cajeroId,
      dispositivo: cobroActualizado.dispositivoId,
      accion: "COBRO_DUPLICADO_IGNORADO",
      entidad: "cobro",
      entidadId: cobroActualizado.id,
      numeroPedido: pedidoAntes.numeroPedido,
      infoAdicional: { estadoDelPedido: pedidoAntes.estado },
    });
    return pedidoAntes;
  }

  const [pedidoActualizado] = await db
    .update(pedidos)
    .set({ estado: "cobrado" })
    .where(eq(pedidos.id, pedidoId))
    .returning();

  const itemsDelPedido = await db
    .select({
      productoId: pedidoItems.productoId,
      cantidad: pedidoItems.cantidadBultos,
      origen: pedidoItems.origen,
    })
    .from(pedidoItems)
    .where(eq(pedidoItems.pedidoId, pedidoId));

  for (const item of itemsDelPedido.filter((i) => i.origen === "deposito")) {
    await db.insert(movimientosStock).values({
      productoId: item.productoId,
      tipo: "salida_venta",
      cantidad: item.cantidad,
      pedidoId,
      registradoPor: "sistema",
      timestamp: new Date(),
    });
  }

  await registrarAuditoria({
    operationId: crypto.randomUUID(),
    usuario: cobroActualizado.cajeroId,
    dispositivo: cobroActualizado.dispositivoId,
    accion: "AUTORIZAR_RETIRO",
    entidad: "pedido",
    entidadId: pedidoId,
    numeroPedido: pedidoActualizado.numeroPedido,
    estadoNuevo: pedidoActualizado,
  });

  return pedidoActualizado;
}

/**
 * Cancela un pedido, haya sido pagado o no.
 *
 * El PIN solo se exige si el pedido YA fue cobrado o retirado: cancelar algo
 * que todavía no tocó dinero ni stock es un simple "me equivoqué", y pedirle
 * al vendedor que consiga el PIN del administrador para corregir un error de
 * tipeo es fricción sin beneficio real. El motivo siempre es obligatorio, con
 * o sin PIN, para que quede registrado el porqué.
 *
 * Si tenía ítems de depósito ya descontados (cobrado o retirado), genera un
 * movimiento de devolución por cada uno para que el stock teórico vuelva a
 * subir — nunca se borra el movimiento de salida original, así el historial
 * completo queda trazable.
 */
export async function cancelarPedido(params: {
  pedidoId: string;
  motivo: string;
  pin?: string;
  usuario: string;
  dispositivo?: string;
}) {
  const db = getDb();

  const anterior = await db.query.pedidos.findFirst({
    where: eq(pedidos.id, params.pedidoId),
  });
  if (!anterior) {
    throw new Error("El pedido no existe.");
  }
  if (anterior.estado === "cancelado") {
    throw new Error("Este pedido ya estaba cancelado.");
  }

  const estabaPagado = anterior.estado === "cobrado" || anterior.estado === "retirado";

  if (estabaPagado) {
    if (!params.pin) {
      throw new Error("Este pedido ya fue cobrado — hace falta el PIN para cancelarlo.");
    }
    await verificarPinConLimite({
      pin: params.pin,
      usuario: params.usuario,
      dispositivo: params.dispositivo,
      entidadId: params.pedidoId,
    });
  }

  if (!params.motivo.trim()) {
    throw new Error("El motivo es obligatorio.");
  }

  if (estabaPagado) {
    const itemsDelPedido = await db
      .select({
        productoId: pedidoItems.productoId,
        cantidad: pedidoItems.cantidadBultos,
        origen: pedidoItems.origen,
      })
      .from(pedidoItems)
      .where(eq(pedidoItems.pedidoId, params.pedidoId));

    for (const item of itemsDelPedido.filter((i) => i.origen === "deposito")) {
      await db.insert(movimientosStock).values({
        productoId: item.productoId,
        tipo: "devolucion",
        cantidad: item.cantidad,
        pedidoId: params.pedidoId,
        motivo: params.motivo,
        registradoPor: params.usuario,
        timestamp: new Date(),
      });
    }

    // El cobro asociado queda "conciliado" en su propia columna, pero esa
    // plata ya no es real — sin esto, el cierre de caja la seguiría contando.
    await db
      .update(cobros)
      .set({ estado: "cancelado" })
      .where(and(eq(cobros.pedidoId, params.pedidoId), eq(cobros.estado, "conciliado")));
  }

  const [actualizado] = await db
    .update(pedidos)
    .set({ estado: "cancelado" })
    .where(eq(pedidos.id, params.pedidoId))
    .returning();

  await registrarAuditoria({
    operationId: crypto.randomUUID(),
    usuario: params.usuario,
    dispositivo: params.dispositivo,
    accion: "CANCELAR_PEDIDO",
    entidad: "pedido",
    entidadId: params.pedidoId,
    numeroPedido: actualizado.numeroPedido,
    estadoAnterior: anterior,
    estadoNuevo: actualizado,
    infoAdicional: { motivo: params.motivo, estabaPagado },
  });

  return actualizado;
}
