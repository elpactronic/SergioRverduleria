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
  const db = getDb();
  await db.insert(auditLog).values({
    operationId: params.operationId,
    usuario: params.usuario,
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
