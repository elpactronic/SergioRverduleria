"use server";

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { usuariosPermitidos } from "@/db/schema";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { registrarAuditoria } from "./audit";
import type { Rol } from "@/lib/roles";

export async function listarUsuariosPermitidos() {
  const db = getDb();
  return db.query.usuariosPermitidos.findMany({
    orderBy: (u, { asc }) => [asc(u.creadoEn)],
  });
}

async function revocarSesionesDe(email: string) {
  try {
    const client = await clerkClient();
    const { data } = await client.users.getUserList({ emailAddress: [email] });
    for (const usuario of data) {
      const { data: sesiones } = await client.sessions.getSessionList({ userId: usuario.id });
      for (const sesion of sesiones) {
        await client.sessions.revokeSession(sesion.id).catch(() => {});
      }
    }
  } catch {
    // Si Clerk no responde, la persona igual queda bloqueada en su próxima
    // navegación (proxy.ts ya no la va a encontrar en la tabla) — no es
    // crítico que la sesión activa se corte al instante.
  }
}

export async function agregarUsuarioPermitido(params: {
  email: string;
  rol: Rol;
  nombre: string;
  usuario: string;
  dispositivo?: string;
}) {
  const email = params.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("El email no es válido.");
  }
  if (!params.nombre.trim()) {
    throw new Error("El nombre es obligatorio.");
  }

  const db = getDb();
  const existente = await db.query.usuariosPermitidos.findFirst({
    where: eq(usuariosPermitidos.email, email),
  });
  if (existente) {
    throw new Error("Ese email ya está en la lista.");
  }

  const [creado] = await db
    .insert(usuariosPermitidos)
    .values({
      email,
      rol: params.rol,
      nombre: params.nombre.trim(),
      actualizadoPor: params.usuario,
    })
    .returning();

  await registrarAuditoria({
    operationId: crypto.randomUUID(),
    usuario: params.usuario,
    dispositivo: params.dispositivo,
    accion: "AGREGAR_USUARIO_PERMITIDO",
    entidad: "usuario_permitido",
    entidadId: creado.id,
    estadoNuevo: creado,
  });

  return creado;
}

export async function cambiarRolUsuario(params: {
  id: string;
  rol: Rol;
  usuario: string;
  dispositivo?: string;
}) {
  const db = getDb();
  const anterior = await db.query.usuariosPermitidos.findFirst({
    where: eq(usuariosPermitidos.id, params.id),
  });
  if (!anterior) throw new Error("No se encontró a esa persona.");

  const [actualizado] = await db
    .update(usuariosPermitidos)
    .set({ rol: params.rol, actualizadoPor: params.usuario })
    .where(eq(usuariosPermitidos.id, params.id))
    .returning();

  await registrarAuditoria({
    operationId: crypto.randomUUID(),
    usuario: params.usuario,
    dispositivo: params.dispositivo,
    accion: "CAMBIAR_ROL_USUARIO",
    entidad: "usuario_permitido",
    entidadId: params.id,
    estadoAnterior: anterior,
    estadoNuevo: actualizado,
  });

  // Si le achicamos permisos, que no siga navegando con la sesión vieja.
  await revocarSesionesDe(actualizado.email);

  return actualizado;
}

export async function quitarUsuarioPermitido(params: {
  id: string;
  usuario: string;
  dispositivo?: string;
}) {
  const db = getDb();
  const anterior = await db.query.usuariosPermitidos.findFirst({
    where: eq(usuariosPermitidos.id, params.id),
  });
  if (!anterior) throw new Error("No se encontró a esa persona.");

  const admins = await db.query.usuariosPermitidos.findMany();
  if (anterior.rol === "admin" && admins.filter((u) => u.rol === "admin").length <= 1) {
    throw new Error("No se puede quitar al único administrador.");
  }

  await db.delete(usuariosPermitidos).where(eq(usuariosPermitidos.id, params.id));

  await registrarAuditoria({
    operationId: crypto.randomUUID(),
    usuario: params.usuario,
    dispositivo: params.dispositivo,
    accion: "QUITAR_USUARIO_PERMITIDO",
    entidad: "usuario_permitido",
    entidadId: params.id,
    estadoAnterior: anterior,
  });

  await revocarSesionesDe(anterior.email);
}

/**
 * Perfil real de quien está logueado ahora mismo (según la sesión verificada
 * de Clerk, no un dato que mande el cliente) — reemplaza el viejo V1/C1
 * autoreportado como "usuario" en pedidos, cobros y auditoría.
 */
export async function obtenerMiPerfil() {
  const { sessionClaims } = await auth();
  const email = (sessionClaims as { email?: string } | null)?.email?.toLowerCase();
  if (!email) return null;

  const db = getDb();
  const fila = await db.query.usuariosPermitidos.findFirst({
    where: eq(usuariosPermitidos.email, email),
  });
  return fila ?? null;
}
