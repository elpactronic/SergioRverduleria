"use server";

import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { productos, type tipoStockEnum } from "@/db/schema";
import { siguienteCodigo } from "@/lib/ids";
import { registrarAuditoria } from "./audit";

type TipoStock = (typeof tipoStockEnum.enumValues)[number];

export async function listarProductos(soloActivos = true) {
  const db = getDb();
  const filas = await db.query.productos.findMany({
    orderBy: (p, { asc }) => [asc(p.nombre)],
  });
  return soloActivos ? filas.filter((p) => p.activo) : filas;
}

export async function crearProducto(params: {
  nombre: string;
  variedad?: string;
  tipoStock: TipoStock;
  precioUnitario: string;
  usuario: string;
  dispositivo?: string;
}) {
  const db = getDb();
  const [ultimo] = await db
    .select({ codigo: productos.codigo })
    .from(productos)
    .orderBy(desc(productos.codigo))
    .limit(1);

  const codigo = siguienteCodigo("P", ultimo?.codigo);

  const [creado] = await db
    .insert(productos)
    .values({
      codigo,
      nombre: params.nombre,
      variedad: params.variedad ?? null,
      tipoStock: params.tipoStock,
      precioUnitario: params.precioUnitario,
    })
    .returning();

  await registrarAuditoria({
    operationId: crypto.randomUUID(),
    usuario: params.usuario,
    dispositivo: params.dispositivo,
    accion: "CREAR_PRODUCTO",
    entidad: "producto",
    entidadId: creado.id,
    estadoNuevo: creado,
  });

  return creado;
}

export async function actualizarProducto(params: {
  id: string;
  nombre: string;
  variedad?: string;
  tipoStock: TipoStock;
  precioUnitario: string;
  usuario: string;
  dispositivo?: string;
}) {
  const db = getDb();
  const anterior = await db.query.productos.findFirst({
    where: eq(productos.id, params.id),
  });

  const [actualizado] = await db
    .update(productos)
    .set({
      nombre: params.nombre,
      variedad: params.variedad ?? null,
      tipoStock: params.tipoStock,
      precioUnitario: params.precioUnitario,
      updatedAt: new Date(),
    })
    .where(eq(productos.id, params.id))
    .returning();

  await registrarAuditoria({
    operationId: crypto.randomUUID(),
    usuario: params.usuario,
    dispositivo: params.dispositivo,
    accion: "EDITAR_PRODUCTO",
    entidad: "producto",
    entidadId: params.id,
    estadoAnterior: anterior,
    estadoNuevo: actualizado,
  });

  return actualizado;
}

export async function darDeBajaProducto(params: {
  id: string;
  usuario: string;
  dispositivo?: string;
}) {
  const db = getDb();
  const anterior = await db.query.productos.findFirst({
    where: eq(productos.id, params.id),
  });

  const [actualizado] = await db
    .update(productos)
    .set({ activo: false, updatedAt: new Date() })
    .where(eq(productos.id, params.id))
    .returning();

  await registrarAuditoria({
    operationId: crypto.randomUUID(),
    usuario: params.usuario,
    dispositivo: params.dispositivo,
    accion: "BAJA_PRODUCTO",
    entidad: "producto",
    entidadId: params.id,
    estadoAnterior: anterior,
    estadoNuevo: actualizado,
  });

  return actualizado;
}
