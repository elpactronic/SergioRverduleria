"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { db, type ClienteCache, type ProductoCache } from "@/lib/offline/db";
import { siguienteNumeroPedido } from "@/lib/offline/numero-pedido";
import { sincronizarTodo, actualizarCatalogosLocales } from "@/lib/offline/sync";
import { getDispositivoId, getUsuario } from "@/lib/session";
import { listarPedidosPagadosRecientes, marcarRetirado } from "@/lib/actions/pedidos";
import { ProductoAutocomplete } from "@/components/producto-autocomplete";
import { TicketConAcciones } from "@/components/ticket-actions";
import { EstadoConexion } from "@/components/estado-conexion";
import { BotonVolver } from "@/components/boton-volver";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ItemForm {
  productoId: string;
  detalle: string;
  cantidadBultos: string;
  precioUnitario: string;
  total: string;
  origen: "mostrador" | "deposito";
}

type PedidoPagado = Awaited<ReturnType<typeof listarPedidosPagadosRecientes>>[number];

function hoyLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export default function VendedorPage() {
  const [clientes, setClientes] = useState<ClienteCache[]>([]);
  const [productos, setProductos] = useState<ProductoCache[]>([]);
  const [clienteId, setClienteId] = useState<string>("");
  const [items, setItems] = useState<ItemForm[]>([]);
  const [cantidad, setCantidad] = useState("1");
  const [precio, setPrecio] = useState("");
  const [productoSeleccionado, setProductoSeleccionado] = useState<ProductoCache | null>(
    null,
  );
  const [origenDeposito, setOrigenDeposito] = useState(false);
  const [pedidoConfirmado, setPedidoConfirmado] = useState<{
    numeroPedido: number;
    fecha: string;
    clienteNombre: string;
    items: ItemForm[];
    total: string;
  } | null>(null);
  const [pedidosPagados, setPedidosPagados] = useState<PedidoPagado[]>([]);
  const [mostrarTodosPagados, setMostrarTodosPagados] = useState(false);
  const [retirandoId, setRetirandoId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (navigator.onLine) {
        try {
          await actualizarCatalogosLocales();
        } catch {
          // Sin conexión real pese al indicador: seguimos con lo que haya en caché.
        }
      }
      setClientes(await db.clientesCache.toArray());
      setProductos(await db.productosCache.toArray());
    })();
  }, []);

  async function refrescarPagados() {
    try {
      const limite = mostrarTodosPagados ? 50 : 5;
      setPedidosPagados(await listarPedidosPagadosRecientes(limite));
    } catch {
      // Sin conexión: se mantiene la última lista que se pudo traer.
    }
  }

  async function confirmarRetiro(p: PedidoPagado) {
    if (
      !window.confirm(
        `¿Confirmás que el cliente retiró el pedido Nº ${String(p.numeroPedido).padStart(3, "0")}?`,
      )
    )
      return;
    setRetirandoId(p.id);
    try {
      await marcarRetirado({
        pedidoId: p.id,
        usuario: getUsuario() || "V1",
        dispositivo: getDispositivoId(),
      });
      await refrescarPagados();
    } finally {
      setRetirandoId(null);
    }
  }

  useEffect(() => {
    (async () => {
      await refrescarPagados();
    })();
    const interval = setInterval(refrescarPagados, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mostrarTodosPagados]);

  function agregarItem() {
    if (!productoSeleccionado || !cantidad || !precio) return;
    const total = (Number(cantidad) * Number(precio)).toFixed(2);
    setItems((prev) => [
      ...prev,
      {
        productoId: productoSeleccionado.id,
        detalle: `${productoSeleccionado.nombre}${
          productoSeleccionado.variedad ? " " + productoSeleccionado.variedad : ""
        }`,
        cantidadBultos: cantidad,
        precioUnitario: precio,
        total,
        origen:
          productoSeleccionado.tipoStock === "controlado" && origenDeposito
            ? "deposito"
            : "mostrador",
      },
    ]);
    setProductoSeleccionado(null);
    setCantidad("1");
    setPrecio("");
    setOrigenDeposito(false);
  }

  function quitarItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const totalPedido = items.reduce((acc, i) => acc + Number(i.total), 0).toFixed(2);

  async function confirmarPedido() {
    if (items.length === 0) return;
    const cliente = clientes.find((c) => c.id === clienteId);
    const { numero, fecha } = await siguienteNumeroPedido();
    const id = crypto.randomUUID();
    const creadoEn = new Date().toISOString();

    await db.pedidosPendientes.add({
      id,
      numeroPedido: numero,
      fecha,
      clienteId: cliente?.id ?? null,
      clienteNombre: cliente?.nombre ?? "Consumidor final",
      vendedorId: getUsuario() || "V1",
      dispositivoId: getDispositivoId(),
      items,
      total: totalPedido,
      creadoEn,
      syncStatus: "pendiente",
    });

    setPedidoConfirmado({
      numeroPedido: numero,
      fecha,
      clienteNombre: cliente?.nombre ?? "Consumidor final",
      items,
      total: totalPedido,
    });
    setItems([]);
    setClienteId("");

    sincronizarTodo();
  }

  if (pedidoConfirmado) {
    return (
      <main className="flex-1 flex flex-col items-center gap-4 p-6">
        <EstadoConexion />
        <h2 className="text-lg font-semibold">Pedido Nº {pedidoConfirmado.numeroPedido} generado</h2>
        <TicketConAcciones
          numeroPedido={pedidoConfirmado.numeroPedido}
          fecha={pedidoConfirmado.fecha}
          clienteNombre={pedidoConfirmado.clienteNombre}
          items={pedidoConfirmado.items}
          total={pedidoConfirmado.total}
        />
        <Button onClick={() => setPedidoConfirmado(null)}>Nuevo pedido</Button>
        <Link href="/" className="text-sm underline text-neutral-500">
          Volver al inicio
        </Link>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col gap-4 p-4 max-w-2xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BotonVolver mensaje="¿Salir sin terminar el pedido? Se perderá lo que cargaste." />
          <h1 className="text-xl font-bold">Nuevo pedido</h1>
        </div>
        <EstadoConexion />
      </div>

      <div>
        <label className="text-sm font-medium mb-1 block">Cliente</label>
        <Select value={clienteId} onValueChange={(v) => setClienteId(v ?? "")}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Seleccionar cliente">
              {(value: string | null) =>
                clientes.find((c) => c.id === value)?.nombre ?? "Seleccionar cliente"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {clientes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg p-3 flex flex-col gap-3 bg-card">
        <label className="text-sm font-medium">Agregar producto</label>
        <ProductoAutocomplete
          productos={productos}
          onSeleccionar={(p) => {
            setProductoSeleccionado(p);
            setPrecio(p.precioUnitario);
            setOrigenDeposito(false);
          }}
        />
        {productoSeleccionado && (
          <div className="flex flex-col gap-2">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <span className="text-xs text-neutral-500">
                  {productoSeleccionado.nombre}
                  {productoSeleccionado.variedad ? ` — ${productoSeleccionado.variedad}` : ""}
                </span>
              </div>
              <div>
                <label className="text-xs">Cant. (bultos)</label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  className="w-24"
                />
              </div>
              <div>
                <label className="text-xs">Precio unit.</label>
                <Input
                  type="number"
                  min="0"
                  value={precio}
                  onChange={(e) => setPrecio(e.target.value)}
                  className="w-28"
                />
              </div>
              <Button onClick={agregarItem}>Agregar</Button>
            </div>
            {productoSeleccionado.tipoStock === "controlado" && (
              <label className="flex items-center gap-2 text-xs text-neutral-600">
                <Switch checked={origenDeposito} onCheckedChange={setOrigenDeposito} />
                Esta vez sale de depósito (descuenta stock)
              </label>
            )}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cant</TableHead>
              <TableHead>Detalle</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, idx) => (
              <TableRow key={idx}>
                <TableCell>{item.cantidadBultos}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {item.detalle}
                    {item.origen === "deposito" && (
                      <Badge variant="secondary" className="text-[10px]">
                        Depósito · se descuenta
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">{item.precioUnitario}</TableCell>
                <TableCell className="text-right">{item.total}</TableCell>
                <TableCell>
                  <button
                    className="text-red-500 text-xs"
                    onClick={() => quitarItem(idx)}
                  >
                    quitar
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <div className="flex justify-between items-center border-t pt-3">
        <span className="font-bold">Total: ${totalPedido}</span>
        <Button size="lg" disabled={items.length === 0} onClick={confirmarPedido}>
          Confirmar pedido e imprimir
        </Button>
      </div>

      <div className="text-xs text-neutral-400 text-center">
        Fecha: {hoyLocal()} · Funciona sin conexión, se sincroniza solo
      </div>

      {pedidosPagados.length > 0 && (
        <div className="border-t pt-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium">
              {mostrarTodosPagados ? "Pedidos pagados" : "Últimos 5 pedidos pagados"}
            </h2>
            <button
              className="text-xs underline text-neutral-500"
              onClick={() => setMostrarTodosPagados((v) => !v)}
            >
              {mostrarTodosPagados ? "Mostrar menos" : "Mostrar todos"}
            </button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Hora pago</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pedidosPagados.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>Nº {String(p.numeroPedido).padStart(3, "0")}</TableCell>
                  <TableCell>{p.clienteNombre ?? "Consumidor final"}</TableCell>
                  <TableCell>
                    {new Date(p.cobradoEn).toLocaleTimeString("es-AR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell className="text-right">${p.total}</TableCell>
                  <TableCell>
                    {p.estado === "retirado" ? (
                      <Badge variant="secondary">
                        Retirado{" "}
                        {p.retiradoEn &&
                          new Date(p.retiradoEn).toLocaleTimeString("es-AR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                      </Badge>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge>Puede retirar</Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={retirandoId === p.id}
                          onClick={() => confirmarRetiro(p)}
                        >
                          Retirado
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </main>
  );
}
