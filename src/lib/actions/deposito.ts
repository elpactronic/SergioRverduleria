"use server";

import { and, eq, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  productos,
  aperturaStock,
  movimientosStock,
  stockFisicoConteo,
  pedidos,
  pedidoItems,
} from "@/db/schema";
import { registrarAuditoria } from "./audit";

export async function listarProductosControlados() {
  const db = getDb();
  const filas = await db.query.productos.findMany({
    where: and(eq(productos.tipoStock, "controlado"), eq(productos.activo, true)),
    orderBy: (p, { asc }) => [asc(p.nombre)],
  });
  return filas;
}

/**
 * El stock de depósito NO se reinicia todos los días: es acumulativo, y solo
 * cambia por ventas, entradas de mercadería, devoluciones y ajustes. Un
 * "recuento" (fila en apertura_stock) es la base desde la que se cuenta a
 * partir de esa fecha, no una obligación diaria. Esta función calcula el
 * stock persistente de cada producto al comienzo de una fecha dada, tomando
 * el recuento más reciente registrado hasta ese momento y sumando todos los
 * movimientos ocurridos después de ese recuento y antes de la fecha.
 */
async function calcularBaseYMovimientosHasta(fecha: string) {
  const db = getDb();
  const [aperturas, movimientos] = await Promise.all([
    db.query.aperturaStock.findMany({ where: lte(aperturaStock.fecha, fecha) }),
    db
      .select({
        productoId: movimientosStock.productoId,
        tipo: movimientosStock.tipo,
        cantidad: movimientosStock.cantidad,
        fecha: sql<string>`${movimientosStock.timestamp}::date`,
      })
      .from(movimientosStock)
      .where(sql`${movimientosStock.timestamp}::date <= ${fecha}::date`),
  ]);
  return { aperturas, movimientos };
}

function netoMovimiento(tipo: string, cantidad: string): number {
  const n = Number(cantidad);
  if (tipo === "salida_venta") return -n;
  return n; // entrada, devolucion y ajuste suman (un ajuste negativo se carga con cantidad negativa)
}

function stockAlInicioDelDia(
  productoId: string,
  fecha: string,
  aperturas: { productoId: string; fecha: string; cantidadInicial: string }[],
  movimientos: { productoId: string; tipo: string; cantidad: string; fecha: string }[],
): number {
  const aperturasProducto = aperturas.filter((a) => a.productoId === productoId);
  const base = aperturasProducto.reduce<typeof aperturasProducto[number] | null>(
    (mejor, a) => (!mejor || a.fecha > mejor.fecha ? a : mejor),
    null,
  );
  const baseValor = base ? Number(base.cantidadInicial) : 0;
  const baseFecha = base?.fecha ?? null;

  const previos = movimientos.filter(
    (m) =>
      m.productoId === productoId &&
      m.fecha < fecha &&
      (baseFecha === null || m.fecha > baseFecha),
  );

  return previos.reduce((acc, m) => acc + netoMovimiento(m.tipo, m.cantidad), baseValor);
}

export interface ResumenStockDia {
  productoId: string;
  stockInicial: number;
  vendidos: number;
  retirados: number;
}

/**
 * Resumen de depósito para una fecha: stock al inicio del día, cuánto se
 * vendió (se descuenta del teórico apenas se cobra) y cuánto se retiró de
 * verdad ese día. "Vendidos" y "retirados" pueden no coincidir — un pedido
 * cobrado pero todavía no retirado ya está descontado del teórico aunque
 * físicamente siga en el depósito.
 */
export async function obtenerResumenStock(fecha: string): Promise<ResumenStockDia[]> {
  const db = getDb();
  const [controlados, { aperturas, movimientos }, retiros] = await Promise.all([
    listarProductosControlados(),
    calcularBaseYMovimientosHasta(fecha),
    db
      .select({
        productoId: pedidoItems.productoId,
        cantidad: pedidoItems.cantidadBultos,
      })
      .from(pedidoItems)
      .innerJoin(pedidos, eq(pedidoItems.pedidoId, pedidos.id))
      .where(
        and(eq(pedidoItems.origen, "deposito"), sql`${pedidos.retiradoEn}::date = ${fecha}::date`),
      ),
  ]);

  return controlados.map((p) => {
    const vendidos = movimientos
      .filter((m) => m.productoId === p.id && m.fecha === fecha && m.tipo === "salida_venta")
      .reduce((acc, m) => acc + Number(m.cantidad), 0);
    const retirados = retiros
      .filter((r) => r.productoId === p.id)
      .reduce((acc, r) => acc + Number(r.cantidad), 0);

    return {
      productoId: p.id,
      stockInicial: stockAlInicioDelDia(p.id, fecha, aperturas, movimientos),
      vendidos,
      retirados,
    };
  });
}

async function upsertAperturas(
  fecha: string,
  items: { productoId: string; cantidadInicial: string }[],
  usuario: string,
) {
  const db = getDb();

  for (const item of items) {
    const existente = await db.query.aperturaStock.findFirst({
      where: and(eq(aperturaStock.fecha, fecha), eq(aperturaStock.productoId, item.productoId)),
    });

    if (existente) {
      await db
        .update(aperturaStock)
        .set({ cantidadInicial: item.cantidadInicial, timestamp: new Date() })
        .where(eq(aperturaStock.id, existente.id));
    } else {
      await db.insert(aperturaStock).values({
        productoId: item.productoId,
        fecha,
        cantidadInicial: item.cantidadInicial,
        registradoPor: usuario,
        timestamp: new Date(),
      });
    }
  }
}

export async function guardarApertura(params: {
  fecha: string;
  items: { productoId: string; cantidadInicial: string }[];
  usuario: string;
  dispositivo?: string;
}) {
  await upsertAperturas(params.fecha, params.items, params.usuario);

  await registrarAuditoria({
    operationId: crypto.randomUUID(),
    usuario: params.usuario,
    dispositivo: params.dispositivo,
    accion: "RECUENTO_DEPOSITO",
    entidad: "apertura_stock",
    infoAdicional: { fecha: params.fecha, items: params.items },
  });
}

export async function registrarMovimiento(params: {
  productoId: string;
  tipo: "entrada" | "ajuste";
  cantidad: string;
  motivo?: string;
  usuario: string;
  dispositivo?: string;
}) {
  const db = getDb();
  const [creado] = await db
    .insert(movimientosStock)
    .values({
      productoId: params.productoId,
      tipo: params.tipo,
      cantidad: params.cantidad,
      motivo: params.motivo,
      registradoPor: params.usuario,
      timestamp: new Date(),
    })
    .returning();

  await registrarAuditoria({
    operationId: crypto.randomUUID(),
    usuario: params.usuario,
    dispositivo: params.dispositivo,
    accion: params.tipo === "entrada" ? "ENTRADA_STOCK" : "AJUSTE_STOCK",
    entidad: "movimiento_stock",
    entidadId: creado.id,
    estadoNuevo: creado,
  });

  return creado;
}

/**
 * Guarda el conteo físico del día (para mostrar la diferencia contra lo
 * teórico) y de paso lo deja como el nuevo punto de partida hacia adelante —
 * es el único lugar de la app donde se carga "cuánto hay realmente", así que
 * tiene sentido que ese número sea, a la vez, la corrección. Antes esto vivía
 * separado en "Nuevo recuento" (Stock de depósito); se unificó para no tener
 * dos formularios haciendo casi lo mismo.
 */
export async function guardarConteoFisico(params: {
  fecha: string;
  items: { productoId: string; cantidadContada: string }[];
  usuario: string;
  dispositivo?: string;
}) {
  const db = getDb();

  for (const item of params.items) {
    const existente = await db.query.stockFisicoConteo.findFirst({
      where: and(
        eq(stockFisicoConteo.fecha, params.fecha),
        eq(stockFisicoConteo.productoId, item.productoId),
      ),
    });

    if (existente) {
      await db
        .update(stockFisicoConteo)
        .set({ cantidadContada: item.cantidadContada, timestamp: new Date() })
        .where(eq(stockFisicoConteo.id, existente.id));
    } else {
      await db.insert(stockFisicoConteo).values({
        productoId: item.productoId,
        fecha: params.fecha,
        cantidadContada: item.cantidadContada,
        registradoPor: params.usuario,
        timestamp: new Date(),
      });
    }
  }

  await upsertAperturas(
    params.fecha,
    params.items.map((i) => ({ productoId: i.productoId, cantidadInicial: i.cantidadContada })),
    params.usuario,
  );

  await registrarAuditoria({
    operationId: crypto.randomUUID(),
    usuario: params.usuario,
    dispositivo: params.dispositivo,
    accion: "CONTEO_FISICO",
    entidad: "stock_fisico_conteo",
    infoAdicional: { fecha: params.fecha, items: params.items },
  });
}

export interface FilaReporte {
  productoId: string;
  nombre: string;
  variedad: string | null;
  apertura: number;
  entradas: number;
  devoluciones: number;
  salidas: number;
  ajustes: number;
  teorico: number;
  fisico: number | null;
  diferencia: number | null;
}

export async function obtenerReporte(fecha: string): Promise<FilaReporte[]> {
  const [controlados, { aperturas, movimientos }, conteos] = await Promise.all([
    listarProductosControlados(),
    calcularBaseYMovimientosHasta(fecha),
    getDb().query.stockFisicoConteo.findMany({
      where: eq(stockFisicoConteo.fecha, fecha),
    }),
  ]);

  return controlados.map((producto) => {
    // Stock persistente heredado de días anteriores (recuento más reciente + movimientos desde entonces).
    const apertura = stockAlInicioDelDia(producto.id, fecha, aperturas, movimientos);

    const movsDeHoy = movimientos.filter((m) => m.productoId === producto.id && m.fecha === fecha);
    const entradas = movsDeHoy
      .filter((m) => m.tipo === "entrada")
      .reduce((acc, m) => acc + Number(m.cantidad), 0);
    const devoluciones = movsDeHoy
      .filter((m) => m.tipo === "devolucion")
      .reduce((acc, m) => acc + Number(m.cantidad), 0);
    const salidas = movsDeHoy
      .filter((m) => m.tipo === "salida_venta")
      .reduce((acc, m) => acc + Number(m.cantidad), 0);
    const ajustes = movsDeHoy
      .filter((m) => m.tipo === "ajuste")
      .reduce((acc, m) => acc + Number(m.cantidad), 0);
    const teorico = apertura + entradas + devoluciones - salidas + ajustes;
    const conteo = conteos.find((c) => c.productoId === producto.id);
    const fisico = conteo ? Number(conteo.cantidadContada) : null;

    return {
      productoId: producto.id,
      nombre: producto.nombre,
      variedad: producto.variedad,
      apertura,
      entradas,
      devoluciones,
      salidas,
      ajustes,
      teorico,
      fisico,
      diferencia: fisico !== null ? fisico - teorico : null,
    };
  });
}
