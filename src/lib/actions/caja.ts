"use server";

import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { cobros } from "@/db/schema";

export interface CierreDeCaja {
  fecha: string;
  totalConciliado: string;
  cantidadConciliados: number;
  totalSinConciliar: string;
  cantidadSinConciliar: number;
  totalCancelados: string;
  cantidadCancelados: number;
}

/**
 * Cierre de caja de una fecha: cuánto se cobró de verdad (conciliado), más lo
 * que quedó sin conciliar o se canceló ese día, para que quede visible y no
 * se confunda con la plata real. Se basa en cuándo se REGISTRÓ el cobro, no
 * en la fecha del pedido (un cobro registrado hoy vale para el cierre de hoy).
 */
export async function obtenerCierreDeCaja(fecha: string): Promise<CierreDeCaja> {
  const db = getDb();

  const cobrosDelDia = await db
    .select({ monto: cobros.monto, estado: cobros.estado })
    .from(cobros)
    .where(sql`${cobros.registradoEn}::date = ${fecha}::date`);

  const porEstado = (estado: string) => cobrosDelDia.filter((c) => c.estado === estado);
  const sumar = (filas: { monto: string }[]) =>
    filas.reduce((acc, c) => acc + Number(c.monto), 0).toFixed(2);

  const conciliados = porEstado("conciliado");
  const sinConciliar = porEstado("sin_conciliar");
  const cancelados = porEstado("cancelado");

  return {
    fecha,
    totalConciliado: sumar(conciliados),
    cantidadConciliados: conciliados.length,
    totalSinConciliar: sumar(sinConciliar),
    cantidadSinConciliar: sinConciliar.length,
    totalCancelados: sumar(cancelados),
    cantidadCancelados: cancelados.length,
  };
}
