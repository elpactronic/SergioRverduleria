"use server";

import { and, eq, max } from "drizzle-orm";
import { getDb } from "@/db";
import {
  pedidos,
  pedidoItems,
  productos,
  movimientosStock,
  cobros,
} from "@/db/schema";
import { registrarAuditoria } from "./audit";

export interface PedidoItemSync {
  productoId: string;
  detalle: string;
  cantidadBultos: string;
  precioUnitario: string;
  total: string;
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

  for (const cobro of huerfanos.filter((c) => c.pedidoId === null)) {
    await conciliarCobro(cobro.id, pedidoId);
  }
}

export async function conciliarCobro(cobroId: string, pedidoId: string) {
  const db = getDb();
  const [cobroActualizado] = await db
    .update(cobros)
    .set({ pedidoId, estado: "conciliado" })
    .where(eq(cobros.id, cobroId))
    .returning();

  const [pedidoActualizado] = await db
    .update(pedidos)
    .set({ estado: "cobrado" })
    .where(eq(pedidos.id, pedidoId))
    .returning();

  const itemsControlados = await db
    .select({
      productoId: pedidoItems.productoId,
      cantidad: pedidoItems.cantidadBultos,
      tipoStock: productos.tipoStock,
    })
    .from(pedidoItems)
    .innerJoin(productos, eq(pedidoItems.productoId, productos.id))
    .where(eq(pedidoItems.pedidoId, pedidoId));

  for (const item of itemsControlados.filter((i) => i.tipoStock === "controlado")) {
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
