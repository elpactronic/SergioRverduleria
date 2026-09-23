"use server";

import { and, eq, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  productos,
  aperturaStock,
  movimientosStock,
  stockFisicoConteo,
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

/** Stock persistente de cada producto controlado al comienzo de `fecha` (para prellenar referencias, no un formulario obligatorio). */
export async function obtenerStockActual(fecha: string) {
  const [controlados, { aperturas, movimientos }] = await Promise.all([
    listarProductosControlados(),
    calcularBaseYMovimientosHasta(fecha),
  ]);

  return controlados.map((p) => ({
    productoId: p.id,
    cantidad: stockAlInicioDelDia(p.id, fecha, aperturas, movimientos),
  }));
}

export async function guardarApertura(params: {
  fecha: string;
  items: { productoId: string; cantidadInicial: string }[];
  usuario: string;
  dispositivo?: string;
}) {
  const db = getDb();

  for (const item of params.items) {
    const existente = await db.query.aperturaStock.findFirst({
      where: and(
        eq(aperturaStock.fecha, params.fecha),
        eq(aperturaStock.productoId, item.productoId),
      ),
    });

    if (existente) {
      await db
        .update(aperturaStock)
        .set({ cantidadInicial: item.cantidadInicial, timestamp: new Date() })
        .where(eq(aperturaStock.id, existente.id));
    } else {
      await db.insert(aperturaStock).values({
        productoId: item.productoId,
        fecha: params.fecha,
        cantidadInicial: item.cantidadInicial,
        registradoPor: params.usuario,
        timestamp: new Date(),
      });
    }
  }

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
