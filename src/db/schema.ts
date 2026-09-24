import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  boolean,
  date,
  timestamp,
  jsonb,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const tipoStockEnum = pgEnum("tipo_stock", ["libre", "controlado"]);
export const estadoPedidoEnum = pgEnum("estado_pedido", [
  "creado",
  "cobrado",
  "retirado",
  "cancelado",
]);
export const origenItemEnum = pgEnum("origen_item_pedido", [
  "mostrador",
  "deposito",
]);
export const tipoMovimientoEnum = pgEnum("tipo_movimiento", [
  "salida_venta",
  "entrada",
  "ajuste",
  "devolucion",
]);

export const clientes = pgTable("clientes", {
  id: uuid("id").primaryKey().defaultRandom(),
  codigo: text("codigo").notNull().unique(),
  nombre: text("nombre").notNull(),
  activo: boolean("activo").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const productos = pgTable("productos", {
  id: uuid("id").primaryKey().defaultRandom(),
  codigo: text("codigo").notNull().unique(),
  nombre: text("nombre").notNull(),
  variedad: text("variedad"),
  tipoStock: tipoStockEnum("tipo_stock").notNull().default("libre"),
  precioUnitario: numeric("precio_unitario", {
    precision: 12,
    scale: 2,
  }).notNull(),
  activo: boolean("activo").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const pedidos = pgTable(
  "pedidos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    numeroPedido: integer("numero_pedido").notNull(),
    fecha: date("fecha").notNull(),
    clienteId: uuid("cliente_id").references(() => clientes.id),
    vendedorId: text("vendedor_id").notNull(),
    dispositivoId: text("dispositivo_id"),
    estado: estadoPedidoEnum("estado").notNull().default("creado"),
    total: numeric("total", { precision: 12, scale: 2 }).notNull(),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull(),
    retiradoEn: timestamp("retirado_en", { withTimezone: true }),
    sincronizadoEn: timestamp("sincronizado_en", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("pedidos_fecha_numero_idx").on(table.fecha, table.numeroPedido),
  ],
);

export const pedidoItems = pgTable("pedido_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  pedidoId: uuid("pedido_id")
    .notNull()
    .references(() => pedidos.id),
  productoId: uuid("producto_id")
    .notNull()
    .references(() => productos.id),
  detalle: text("detalle").notNull(),
  cantidadBultos: numeric("cantidad_bultos", {
    precision: 12,
    scale: 2,
  }).notNull(),
  precioUnitario: numeric("precio_unitario", {
    precision: 12,
    scale: 2,
  }).notNull(),
  total: numeric("total", { precision: 12, scale: 2 }).notNull(),
  origen: origenItemEnum("origen").notNull().default("mostrador"),
});

export const cobros = pgTable("cobros", {
  id: uuid("id").primaryKey().defaultRandom(),
  pedidoNumero: integer("pedido_numero").notNull(),
  pedidoFecha: date("pedido_fecha").notNull(),
  pedidoId: uuid("pedido_id").references(() => pedidos.id),
  cajeroId: text("cajero_id").notNull(),
  dispositivoId: text("dispositivo_id"),
  monto: numeric("monto", { precision: 12, scale: 2 }).notNull(),
  estado: text("estado").notNull().default("registrado"), // registrado | conciliado | sin_conciliar
  registradoEn: timestamp("registrado_en", { withTimezone: true }).notNull(),
  sincronizadoEn: timestamp("sincronizado_en", { withTimezone: true }),
});

export const aperturaStock = pgTable("apertura_stock", {
  id: uuid("id").primaryKey().defaultRandom(),
  productoId: uuid("producto_id")
    .notNull()
    .references(() => productos.id),
  fecha: date("fecha").notNull(),
  cantidadInicial: numeric("cantidad_inicial", {
    precision: 12,
    scale: 2,
  }).notNull(),
  registradoPor: text("registrado_por").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
});

export const movimientosStock = pgTable("movimientos_stock", {
  id: uuid("id").primaryKey().defaultRandom(),
  productoId: uuid("producto_id")
    .notNull()
    .references(() => productos.id),
  tipo: tipoMovimientoEnum("tipo").notNull(),
  cantidad: numeric("cantidad", { precision: 12, scale: 2 }).notNull(),
  pedidoId: uuid("pedido_id").references(() => pedidos.id),
  motivo: text("motivo"),
  registradoPor: text("registrado_por").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
});

export const stockFisicoConteo = pgTable("stock_fisico_conteo", {
  id: uuid("id").primaryKey().defaultRandom(),
  productoId: uuid("producto_id")
    .notNull()
    .references(() => productos.id),
  fecha: date("fecha").notNull(),
  cantidadContada: numeric("cantidad_contada", {
    precision: 12,
    scale: 2,
  }).notNull(),
  registradoPor: text("registrado_por").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  operationId: uuid("operation_id").notNull(),
  usuario: text("usuario").notNull(),
  clerkUserId: text("clerk_user_id"),
  dispositivo: text("dispositivo"),
  accion: text("accion").notNull(),
  entidad: text("entidad").notNull(),
  entidadId: text("entidad_id"),
  numeroPedido: integer("numero_pedido"),
  estadoAnterior: jsonb("estado_anterior"),
  estadoNuevo: jsonb("estado_nuevo"),
  infoAdicional: jsonb("info_adicional"),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
});
