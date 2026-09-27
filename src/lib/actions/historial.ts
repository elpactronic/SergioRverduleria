"use server";

import { and, eq, isNotNull, lt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLog } from "@/db/schema";
import { obtenerDiasRetencionHistorial } from "./configuracion";

export interface BuscarHistorialParams {
  numeroPedido?: number;
  fecha?: string;
}

/** Trae los eventos de auditoría de pedidos (creación, cobro, retiro, cancelación), para reconstruir qué pasó ante un reclamo. */
export async function buscarHistorial(params: BuscarHistorialParams) {
  const db = getDb();

  const condiciones = [isNotNull(auditLog.numeroPedido)];
  if (params.numeroPedido) {
    condiciones.push(eq(auditLog.numeroPedido, params.numeroPedido));
  }
  if (params.fecha) {
    condiciones.push(sql`${auditLog.timestamp}::date = ${params.fecha}::date`);
  }

  const filas = await db.query.auditLog.findMany({
    where: and(...condiciones),
    orderBy: (a, { asc }) => [asc(a.timestamp)],
  });

  return filas;
}

/**
 * Vista por defecto de la pantalla de Historial: toda la actividad dentro de
 * la ventana de retención configurada (o de los últimos `diasPorDefecto` días
 * si todavía no se configuró nada), sin necesidad de elegir una fecha puntual.
 */
export async function listarActividadReciente(diasPorDefecto = 1) {
  const db = getDb();
  const dias = (await obtenerDiasRetencionHistorial()) ?? diasPorDefecto;
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

  const filas = await db.query.auditLog.findMany({
    where: and(isNotNull(auditLog.numeroPedido), sql`${auditLog.timestamp} >= ${desde}`),
    orderBy: (a, { asc }) => [asc(a.timestamp)],
  });

  return { filas, dias };
}

/**
 * Borra el historial de auditoría más viejo que los días configurados en
 * Configuración. Si no hay ningún límite configurado, no hace nada (se
 * conserva todo, comportamiento de siempre). Solo afecta a `audit_log` — los
 * pedidos y cobros en sí no se tocan, así que el cierre de caja y el resto
 * de los reportes de fechas viejas siguen funcionando igual.
 */
export async function limpiarHistorialAntiguo(): Promise<number> {
  const dias = await obtenerDiasRetencionHistorial();
  if (dias === null) return 0;

  const db = getDb();
  const limite = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

  const borrados = await db.delete(auditLog).where(lt(auditLog.timestamp, limite)).returning({ id: auditLog.id });
  return borrados.length;
}

