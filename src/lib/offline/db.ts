import Dexie, { type EntityTable } from "dexie";

export type TipoStock = "libre" | "controlado";

export interface ProductoCache {
  id: string;
  codigo: string;
  nombre: string;
  variedad: string | null;
  tipoStock: TipoStock;
  precioUnitario: string;
  activo: boolean;
  actualizadoEn: string; // ISO timestamp de la última sincronización de este dato
}

export interface ClienteCache {
  id: string;
  codigo: string;
  nombre: string;
  activo: boolean;
  actualizadoEn: string;
}

export type OrigenItem = "mostrador" | "deposito";

export interface PedidoItemLocal {
  productoId: string;
  detalle: string;
  cantidadBultos: string;
  precioUnitario: string;
  total: string;
  origen: OrigenItem;
}

export type SyncStatus = "pendiente" | "sincronizado" | "error";

export interface PedidoLocal {
  id: string; // uuid generado en el dispositivo
  numeroPedido: number;
  fecha: string; // yyyy-MM-dd, fecha local del dispositivo
  clienteId: string | null;
  clienteNombre: string;
  vendedorId: string;
  dispositivoId: string;
  items: PedidoItemLocal[];
  total: string;
  creadoEn: string; // ISO timestamp
  syncStatus: SyncStatus;
  syncError?: string;
}

export interface CobroLocal {
  id: string;
  pedidoNumero: number;
  pedidoFecha: string;
  cajeroId: string;
  dispositivoId: string;
  monto: string;
  registradoEn: string;
  syncStatus: SyncStatus;
  syncError?: string;
}

export interface ContadorLocal {
  fecha: string; // yyyy-MM-dd, clave primaria
  ultimoNumero: number;
}

const db = new Dexie("verduleria-rogel") as Dexie & {
  productosCache: EntityTable<ProductoCache, "id">;
  clientesCache: EntityTable<ClienteCache, "id">;
  pedidosPendientes: EntityTable<PedidoLocal, "id">;
  cobrosPendientes: EntityTable<CobroLocal, "id">;
  contadores: EntityTable<ContadorLocal, "fecha">;
};

db.version(1).stores({
  productosCache: "id, codigo, nombre, tipoStock, activo",
  clientesCache: "id, codigo, nombre, activo",
  pedidosPendientes: "id, numeroPedido, fecha, syncStatus, creadoEn",
  cobrosPendientes: "id, pedidoNumero, pedidoFecha, syncStatus, registradoEn",
  contadores: "fecha",
});

export { db };
