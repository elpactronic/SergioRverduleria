import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/db";
import { auditLog } from "@/db/schema";

export async function registrarAuditoria(params: {
  operationId: string;
  usuario: string;
  dispositivo?: string | null;
  accion: string;
  entidad: string;
  entidadId?: string | null;
  numeroPedido?: number | null;
  estadoAnterior?: unknown;
  estadoNuevo?: unknown;
  infoAdicional?: unknown;
}) {
  // El "usuario" (V1/C1) lo elige libremente el dispositivo, no es
  // verificable. El clerkUserId sí sale de la sesión autenticada real, y es
  // lo que le da valor probatorio a este registro ante un reclamo.
  let clerkUserId: string | null = null;
  try {
    clerkUserId = (await auth()).userId;
  } catch {
    // Fuera de un contexto de request (ej. scripts locales de seed/cleanup): sin sesión, sin problema.
  }

  const db = getDb();
  await db.insert(auditLog).values({
    operationId: params.operationId,
    usuario: params.usuario,
    clerkUserId,
    dispositivo: params.dispositivo ?? null,
    accion: params.accion,
    entidad: params.entidad,
    entidadId: params.entidadId ?? null,
    numeroPedido: params.numeroPedido ?? null,
    estadoAnterior: params.estadoAnterior ?? null,
    estadoNuevo: params.estadoNuevo ?? null,
    infoAdicional: params.infoAdicional ?? null,
    timestamp: new Date(),
  });
}
