"use server";

import { and, eq, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLog } from "@/db/schema";

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

