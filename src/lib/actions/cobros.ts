"use server";

import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { cobros, pedidos } from "@/db/schema";
import { registrarAuditoria } from "./audit";
import { conciliarCobro } from "./pedidos";

export interface CobroSync {
  id: string;
  pedidoNumero: number;
  pedidoFecha: string;
  cajeroId: string;
  dispositivoId?: string;
  monto: string;
  registradoEn: string;
}

/** Lista cobros que llegaron sin poder conciliarse con un pedido, para revisión manual. */
export async function listarCobrosSinConciliar() {
  const db = getDb();
  return db.query.cobros.findMany({
    where: eq(cobros.estado, "sin_conciliar"),
    orderBy: (c, { desc }) => [desc(c.registradoEn)],
  });
}

/**
 * Cancela un cobro que quedó sin conciliar (nunca encontró su pedido, ej.
 * número mal tipeado). Solo aplica a cobros sin_conciliar: uno ya conciliado
 * movió stock y estado del pedido, así que cancelarlo es una devolución, no
 * esto.
 */
export async function cancelarCobro(params: {
  cobroId: string;
  usuario: string;
  dispositivo?: string;
}) {
  const db = getDb();
  const anterior = await db.query.cobros.findFirst({
    where: eq(cobros.id, params.cobroId),
  });
  if (!anterior || anterior.estado !== "sin_conciliar") {
    throw new Error(
      "Solo se pueden cancelar cobros sin conciliar. Un cobro ya conciliado requiere una devolución.",
    );
  }

  const [actualizado] = await db
    .update(cobros)
    .set({ estado: "cancelado" })
    .where(eq(cobros.id, params.cobroId))
    .returning();

  await registrarAuditoria({
    operationId: crypto.randomUUID(),
    usuario: params.usuario,
    dispositivo: params.dispositivo,
    accion: "CANCELAR_COBRO",
    entidad: "cobro",
    entidadId: params.cobroId,
    numeroPedido: actualizado.pedidoNumero,
    estadoAnterior: anterior,
    estadoNuevo: actualizado,
  });

  return actualizado;
}

/**
 * Sincroniza un cobro registrado offline en caja. Idempotente por UUID.
 * Intenta conciliar contra un pedido existente por (fecha, número); si el
 * pedido todavía no llegó al servidor, queda "sin_conciliar" y se resuelve
 * más tarde cuando el pedido sincronice (ver conciliarCobrosPendientesDe).
 */
export async function sincronizarCobro(cobro: CobroSync) {
  const db = getDb();

  const existente = await db.query.cobros.findFirst({
    where: eq(cobros.id, cobro.id),
  });
  if (existente) {
    return { ok: true as const, yaExistia: true };
  }

  const pedido = await db.query.pedidos.findFirst({
    where: and(
      eq(pedidos.fecha, cobro.pedidoFecha),
      eq(pedidos.numeroPedido, cobro.pedidoNumero),
    ),
  });

  const [creado] = await db
    .insert(cobros)
    .values({
      id: cobro.id,
      pedidoNumero: cobro.pedidoNumero,
      pedidoFecha: cobro.pedidoFecha,
      pedidoId: pedido?.id ?? null,
      cajeroId: cobro.cajeroId,
      dispositivoId: cobro.dispositivoId,
      monto: cobro.monto,
      estado: pedido ? "conciliado" : "sin_conciliar",
      registradoEn: new Date(cobro.registradoEn),
    })
    .returning();

  await registrarAuditoria({
    operationId: crypto.randomUUID(),
    usuario: cobro.cajeroId,
    dispositivo: cobro.dispositivoId,
    accion: "REGISTRAR_COBRO",
    entidad: "cobro",
    entidadId: creado.id,
    numeroPedido: cobro.pedidoNumero,
    estadoNuevo: creado,
  });

  if (pedido) {
    await conciliarCobro(creado.id, pedido.id);
  }

  return { ok: true as const, yaExistia: false, conciliado: !!pedido };
}
