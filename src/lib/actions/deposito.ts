"use server";

import { and, eq, sql } from "drizzle-orm";
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

export async function obtenerApertura(fecha: string) {
  const db = getDb();
  return db.query.aperturaStock.findMany({
    where: eq(aperturaStock.fecha, fecha),
  });
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
    accion: "APERTURA_DEPOSITO",
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
  const db = getDb();

  const [controlados, aperturas, movimientos, conteos] = await Promise.all([
    listarProductosControlados(),
    obtenerApertura(fecha),
    db
      .select({
        productoId: movimientosStock.productoId,
        tipo: movimientosStock.tipo,
        cantidad: movimientosStock.cantidad,
      })
      .from(movimientosStock)
      .where(sql`${movimientosStock.timestamp}::date = ${fecha}::date`),
    db.query.stockFisicoConteo.findMany({
      where: eq(stockFisicoConteo.fecha, fecha),
    }),
  ]);

  return controlados.map((producto) => {
    const apertura = Number(
      aperturas.find((a) => a.productoId === producto.id)?.cantidadInicial ?? 0,
    );
    const movsDelProducto = movimientos.filter((m) => m.productoId === producto.id);
    const entradas = movsDelProducto
      .filter((m) => m.tipo === "entrada")
      .reduce((acc, m) => acc + Number(m.cantidad), 0);
    const devoluciones = movsDelProducto
      .filter((m) => m.tipo === "devolucion")
      .reduce((acc, m) => acc + Number(m.cantidad), 0);
    const salidas = movsDelProducto
      .filter((m) => m.tipo === "salida_venta")
      .reduce((acc, m) => acc + Number(m.cantidad), 0);
    const ajustes = movsDelProducto
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
