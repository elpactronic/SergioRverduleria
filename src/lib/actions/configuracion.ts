"use server";

import bcrypt from "bcryptjs";
import { and, eq, gte } from "drizzle-orm";
import { getDb } from "@/db";
import { configuracionApp, auditLog } from "@/db/schema";
import { registrarAuditoria } from "./audit";

const SINGLETON_ID = "singleton";

async function obtenerFila() {
  const db = getDb();
  return db.query.configuracionApp.findFirst({
    where: eq(configuracionApp.id, SINGLETON_ID),
  });
}

/**
 * Verifica un PIN contra el hash guardado en la base; si todavía no se
 * configuró ninguno desde /configuracion, cae en la variable de entorno
 * PIN_CANCELACION (el valor con el que arrancó el sistema). Aplica el mismo
 * límite de intentos sin importar desde dónde se llame (cancelar pedido o
 * cambiar el propio PIN), porque las dos son formas de "adivinar el PIN".
 */
export async function verificarPinConLimite(params: {
  pin: string;
  usuario: string;
  dispositivo?: string;
  entidadId?: string;
}): Promise<void> {
  const db = getDb();

  const quinceMinutosAtras = new Date(Date.now() - 15 * 60 * 1000);
  const intentosRecientes = await db.query.auditLog.findMany({
    where: and(
      eq(auditLog.accion, "INTENTO_PIN_FALLIDO"),
      gte(auditLog.timestamp, quinceMinutosAtras),
    ),
  });
  if (intentosRecientes.length >= 5) {
    throw new Error("Demasiados intentos de PIN incorrecto. Esperá 15 minutos antes de volver a intentar.");
  }

  const fila = await obtenerFila();
  let esValido: boolean;

  if (fila?.pinCancelacionHash) {
    esValido = await bcrypt.compare(params.pin, fila.pinCancelacionHash);
  } else {
    const pinEnv = process.env.PIN_CANCELACION;
    if (!pinEnv) {
      throw new Error("El sistema no tiene un PIN configurado. Avisá al administrador.");
    }
    esValido = params.pin === pinEnv;
  }

  if (!esValido) {
    await registrarAuditoria({
      operationId: crypto.randomUUID(),
      usuario: params.usuario,
      dispositivo: params.dispositivo,
      accion: "INTENTO_PIN_FALLIDO",
      entidad: "configuracion",
      entidadId: params.entidadId ?? null,
    });
    throw new Error("PIN incorrecto.");
  }
}

/** Cambia el PIN de cancelación. Requiere conocer el PIN actual (protegido por el mismo límite de intentos). */
export async function cambiarPin(params: {
  pinActual: string;
  pinNuevo: string;
  usuario: string;
  dispositivo?: string;
}) {
  if (!/^\d{6}$/.test(params.pinNuevo)) {
    throw new Error("El PIN nuevo debe tener exactamente 6 dígitos numéricos.");
  }

  await verificarPinConLimite({
    pin: params.pinActual,
    usuario: params.usuario,
    dispositivo: params.dispositivo,
  });

  const db = getDb();
  const hash = await bcrypt.hash(params.pinNuevo, 10);
  const existente = await obtenerFila();

  if (existente) {
    await db
      .update(configuracionApp)
      .set({
        pinCancelacionHash: hash,
        actualizadoEn: new Date(),
        actualizadoPor: params.usuario,
      })
      .where(eq(configuracionApp.id, SINGLETON_ID));
  } else {
    await db.insert(configuracionApp).values({
      id: SINGLETON_ID,
      pinCancelacionHash: hash,
      actualizadoEn: new Date(),
      actualizadoPor: params.usuario,
    });
  }

  await registrarAuditoria({
    operationId: crypto.randomUUID(),
    usuario: params.usuario,
    dispositivo: params.dispositivo,
    accion: "CAMBIAR_PIN_CANCELACION",
    entidad: "configuracion",
  });
}

/** Si ya hay un PIN configurado desde la app (para mostrarlo en la UI de Configuración). */
export async function hayPinConfiguradoEnBase(): Promise<boolean> {
  const fila = await obtenerFila();
  return !!fila?.pinCancelacionHash;
}
