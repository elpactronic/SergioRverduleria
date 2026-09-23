import { db } from "./db";
import { reconciliarContador } from "./numero-pedido";
import { listarClientes } from "@/lib/actions/clientes";
import { listarProductos } from "@/lib/actions/productos";
import { sincronizarPedido } from "@/lib/actions/pedidos";
import { sincronizarCobro } from "@/lib/actions/cobros";
import { obtenerUltimoNumeroPedido } from "@/lib/actions/pedidos";

/** Trae el catálogo vigente del servidor y lo guarda en IndexedDB para uso offline. */
export async function actualizarCatalogosLocales() {
  const ahora = new Date().toISOString();
  const [clientes, productos] = await Promise.all([
    listarClientes(true),
    listarProductos(true),
  ]);

  await db.transaction("rw", db.clientesCache, db.productosCache, async () => {
    await db.clientesCache.clear();
    await db.clientesCache.bulkPut(
      clientes.map((c) => ({
        id: c.id,
        codigo: c.codigo,
        nombre: c.nombre,
        activo: c.activo,
        actualizadoEn: ahora,
      })),
    );

    await db.productosCache.clear();
    await db.productosCache.bulkPut(
      productos.map((p) => ({
        id: p.id,
        codigo: p.codigo,
        nombre: p.nombre,
        variedad: p.variedad,
        tipoStock: p.tipoStock,
        precioUnitario: p.precioUnitario,
        activo: p.activo,
        actualizadoEn: ahora,
      })),
    );
  });

  return ahora;
}

export async function reconciliarContadorDeHoy() {
  const fecha = new Date().toISOString().slice(0, 10);
  const maxServidor = await obtenerUltimoNumeroPedido(fecha);
  await reconciliarContador(fecha, maxServidor);
}

export async function flushPedidosPendientes() {
  const pendientes = await db.pedidosPendientes
    .where("syncStatus")
    .equals("pendiente")
    .toArray();

  for (const pedido of pendientes) {
    try {
      await sincronizarPedido({
        id: pedido.id,
        numeroPedido: pedido.numeroPedido,
        fecha: pedido.fecha,
        clienteId: pedido.clienteId,
        vendedorId: pedido.vendedorId,
        dispositivoId: pedido.dispositivoId,
        items: pedido.items,
        total: pedido.total,
        creadoEn: pedido.creadoEn,
      });
      await db.pedidosPendientes.update(pedido.id, { syncStatus: "sincronizado" });
    } catch (err) {
      await db.pedidosPendientes.update(pedido.id, {
        syncStatus: "error",
        syncError: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export async function flushCobrosPendientes() {
  const pendientes = await db.cobrosPendientes
    .where("syncStatus")
    .equals("pendiente")
    .toArray();

  for (const cobro of pendientes) {
    try {
      await sincronizarCobro({
        id: cobro.id,
        pedidoNumero: cobro.pedidoNumero,
        pedidoFecha: cobro.pedidoFecha,
        cajeroId: cobro.cajeroId,
        dispositivoId: cobro.dispositivoId,
        monto: cobro.monto,
        registradoEn: cobro.registradoEn,
      });
      await db.cobrosPendientes.update(cobro.id, { syncStatus: "sincronizado" });
    } catch (err) {
      await db.cobrosPendientes.update(cobro.id, {
        syncStatus: "error",
        syncError: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export async function sincronizarTodo() {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  try {
    await flushPedidosPendientes();
    await flushCobrosPendientes();
    await actualizarCatalogosLocales();
    await reconciliarContadorDeHoy();
  } catch {
    // Sin conexión real pese al indicador online, o el servidor no respondió.
    // Se reintentará en el próximo ciclo o evento "online".
  }
}
