"use server";

import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { cobros, pedidos, clientes } from "@/db/schema";

export interface DetalleCobro {
  numeroPedido: number;
  clienteNombre: string | null;
  monto: string;
  estado: string;
  registradoEn: string;
}

export interface CierreDeCaja {
  fecha: string;
  totalConciliado: string;
  cantidadConciliados: number;
  totalSinConciliar: string;
  cantidadSinConciliar: number;
  totalCancelados: string;
  cantidadCancelados: number;
  detalle: DetalleCobro[];
}

/**
 * Cierre de caja de una fecha: el detalle de cada cobro registrado ese día
 * (como un ticket real de cierre), más los totales por estado para que lo
 * sin conciliar o cancelado no se confunda con la plata real. Se basa en
 * cuándo se REGISTRÓ el cobro, no en la fecha del pedido (un cobro
 * registrado hoy vale para el cierre de hoy).
 */
export async function obtenerCierreDeCaja(fecha: string): Promise<CierreDeCaja> {
  const db = getDb();

  const cobrosDelDia = await db
    .select({
      numeroPedido: cobros.pedidoNumero,
      clienteNombre: clientes.nombre,
      monto: cobros.monto,
      estado: cobros.estado,
      registradoEn: cobros.registradoEn,
    })
    .from(cobros)
    .leftJoin(pedidos, eq(cobros.pedidoId, pedidos.id))
    .leftJoin(clientes, eq(pedidos.clienteId, clientes.id))
    .where(sql`${cobros.registradoEn}::date = ${fecha}::date`)
    .orderBy(cobros.registradoEn);

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
    detalle: cobrosDelDia.map((c) => ({
      numeroPedido: c.numeroPedido,
      clienteNombre: c.clienteNombre,
      monto: c.monto,
      estado: c.estado,
      registradoEn: c.registradoEn.toISOString(),
    })),
  };
}
