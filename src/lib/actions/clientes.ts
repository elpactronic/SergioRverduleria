"use server";

import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { clientes } from "@/db/schema";
import { siguienteCodigo } from "@/lib/ids";
import { registrarAuditoria } from "./audit";

export async function listarClientes(soloActivos = true) {
  const db = getDb();
  const filas = await db.query.clientes.findMany({
    orderBy: (c, { asc }) => [asc(c.nombre)],
  });
  return soloActivos ? filas.filter((c) => c.activo) : filas;
}

export async function crearCliente(params: {
  nombre: string;
  usuario: string;
  dispositivo?: string;
}) {
  const db = getDb();
  const [ultimo] = await db
    .select({ codigo: clientes.codigo })
    .from(clientes)
    .orderBy(desc(clientes.codigo))
    .limit(1);

  const codigo = siguienteCodigo("C", ultimo?.codigo);

  const [creado] = await db
    .insert(clientes)
    .values({ codigo, nombre: params.nombre })
    .returning();

  await registrarAuditoria({
    operationId: crypto.randomUUID(),
    usuario: params.usuario,
    dispositivo: params.dispositivo,
    accion: "CREAR_CLIENTE",
    entidad: "cliente",
    entidadId: creado.id,
    estadoNuevo: creado,
  });

  return creado;
}

export async function actualizarCliente(params: {
  id: string;
  nombre: string;
  usuario: string;
  dispositivo?: string;
}) {
  const db = getDb();
  const anterior = await db.query.clientes.findFirst({
    where: eq(clientes.id, params.id),
  });

  const [actualizado] = await db
    .update(clientes)
    .set({ nombre: params.nombre, updatedAt: new Date() })
    .where(eq(clientes.id, params.id))
    .returning();

  await registrarAuditoria({
    operationId: crypto.randomUUID(),
    usuario: params.usuario,
    dispositivo: params.dispositivo,
    accion: "EDITAR_CLIENTE",
    entidad: "cliente",
    entidadId: params.id,
    estadoAnterior: anterior,
    estadoNuevo: actualizado,
  });

  return actualizado;
}

export async function darDeBajaCliente(params: {
  id: string;
  usuario: string;
  dispositivo?: string;
}) {
  const db = getDb();
  const anterior = await db.query.clientes.findFirst({
    where: eq(clientes.id, params.id),
  });

  const [actualizado] = await db
    .update(clientes)
    .set({ activo: false, updatedAt: new Date() })
    .where(eq(clientes.id, params.id))
    .returning();

  await registrarAuditoria({
    operationId: crypto.randomUUID(),
    usuario: params.usuario,
    dispositivo: params.dispositivo,
    accion: "BAJA_CLIENTE",
    entidad: "cliente",
    entidadId: params.id,
    estadoAnterior: anterior,
    estadoNuevo: actualizado,
  });

  return actualizado;
}
