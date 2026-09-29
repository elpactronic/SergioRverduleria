"use client";

import { useEffect, useRef, useState } from "react";
import { db, type ClienteCache, type ProductoCache, type PedidoLocal } from "@/lib/offline/db";
import { siguienteNumeroPedido } from "@/lib/offline/numero-pedido";
import { sincronizarTodo, actualizarCatalogosLocales } from "@/lib/offline/sync";
import { getDispositivoId, getUsuario } from "@/lib/session";
import { listarPedidosPagadosRecientes, marcarRetirado } from "@/lib/actions/pedidos";
import { crearCliente } from "@/lib/actions/clientes";
import { crearProducto } from "@/lib/actions/productos";
import { guardarApertura } from "@/lib/actions/deposito";
import { sonarCobrado, sonarRetirado } from "@/lib/sonidos";
import { useWakeLock } from "@/lib/use-wake-lock";
import { useSync } from "@/lib/offline/use-sync";
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
  const [agregandoCliente, setAgregandoCliente] = useState(false);
  const [nombreClienteNuevo, setNombreClienteNuevo] = useState("");
  const [guardandoCliente, setGuardandoCliente] = useState(false);
  const [errorClienteNuevo, setErrorClienteNuevo] = useState<string | null>(null);

  const [agregandoProducto, setAgregandoProducto] = useState(false);
  const [nombreProductoNuevo, setNombreProductoNuevo] = useState("");
  const [variedadProductoNuevo, setVariedadProductoNuevo] = useState("");
  const [tipoStockProductoNuevo, setTipoStockProductoNuevo] = useState<"libre" | "controlado">("libre");
  const [precioProductoNuevo, setPrecioProductoNuevo] = useState("");
  const [stockInicialProductoNuevo, setStockInicialProductoNuevo] = useState("");
  const [guardandoProducto, setGuardandoProducto] = useState(false);
  const [errorProductoNuevo, setErrorProductoNuevo] = useState<string | null>(null);
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
  const [confirmando, setConfirmando] = useState(false);
  const [misPedidos, setMisPedidos] = useState<PedidoLocal[]>([]);
  const [mostrarMisPedidos, setMostrarMisPedidos] = useState(false);
  const [reintentandoId, setReintentandoId] = useState<string | null>(null);

  useWakeLock();
  const { online } = useSync();

  const pagadosAnterioresRef = useRef<Map<string, string> | null>(null);

  function detectarCambiosPagados(nuevos: PedidoPagado[]) {
    const anteriores = pagadosAnterioresRef.current;
    if (anteriores) {
      let huboCobrado = false;
      let huboRetirado = false;
      for (const p of nuevos) {
        const estadoAnterior = anteriores.get(p.id);
        if (estadoAnterior === undefined) {
          if (p.estado === "cobrado") huboCobrado = true;
        } else if (estadoAnterior !== p.estado && p.estado === "retirado") {
          huboRetirado = true;
        }
      }
      if (huboRetirado) sonarRetirado();
      if (huboCobrado) sonarCobrado();
    }
    pagadosAnterioresRef.current = new Map(nuevos.map((p) => [p.id, p.estado]));
  }

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
      const nuevos = await listarPedidosPagadosRecientes(limite, hoyLocal());
      detectarCambiosPagados(nuevos);
      setPedidosPagados(nuevos);
    } catch {
      // Sin conexión: se mantiene la última lista que se pudo traer.
    }
  }

  async function refrescarMisPedidos() {
    const todos = await db.pedidosPendientes.orderBy("creadoEn").reverse().limit(15).toArray();
    setMisPedidos(todos);
  }

  async function reintentarPedido(p: PedidoLocal) {
    setReintentandoId(p.id);
    try {
      await db.pedidosPendientes.update(p.id, { syncStatus: "pendiente", syncError: undefined });
      await sincronizarTodo();
      await refrescarMisPedidos();
    } finally {
      setReintentandoId(null);
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

  async function agregarClienteRapido() {
    const nombre = nombreClienteNuevo.trim();
    if (!nombre) return;
    setErrorClienteNuevo(null);
    setGuardandoCliente(true);
    try {
      const nuevo = await crearCliente({
        nombre,
        usuario: getUsuario() || "V1",
        dispositivo: getDispositivoId(),
      });
      const nuevoCache = {
        id: nuevo.id,
        codigo: nuevo.codigo,
        nombre: nuevo.nombre,
        activo: nuevo.activo,
        actualizadoEn: new Date().toISOString(),
      };
      await db.clientesCache.put(nuevoCache);
      setClientes((prev) => [...prev, nuevoCache].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setClienteId(nuevo.id);
      setAgregandoCliente(false);
      setNombreClienteNuevo("");
    } catch {
      setErrorClienteNuevo(
        "No se pudo agregar (¿sin conexión?). Podés seguir el pedido como \"Consumidor final\" y cargar el cliente más tarde desde Clientes.",
      );
    } finally {
      setGuardandoCliente(false);
    }
  }

  async function agregarProductoRapido() {
    const nombre = nombreProductoNuevo.trim();
    if (!nombre || !precioProductoNuevo) return;
    setErrorProductoNuevo(null);
    setGuardandoProducto(true);
    try {
      const usuario = getUsuario() || "V1";
      const dispositivo = getDispositivoId();
      const nuevo = await crearProducto({
        nombre,
        variedad: variedadProductoNuevo.trim() || undefined,
        tipoStock: tipoStockProductoNuevo,
        precioUnitario: precioProductoNuevo,
        usuario,
        dispositivo,
      });

      if (tipoStockProductoNuevo === "controlado" && stockInicialProductoNuevo.trim() !== "") {
        await guardarApertura({
          fecha: hoyLocal(),
          items: [{ productoId: nuevo.id, cantidadInicial: stockInicialProductoNuevo }],
          usuario,
          dispositivo,
        });
      }

      const nuevoCache = {
        id: nuevo.id,
        codigo: nuevo.codigo,
        nombre: nuevo.nombre,
        variedad: nuevo.variedad,
        tipoStock: nuevo.tipoStock,
        precioUnitario: nuevo.precioUnitario,
        activo: nuevo.activo,
        actualizadoEn: new Date().toISOString(),
      };
      await db.productosCache.put(nuevoCache);
      setProductos((prev) => [...prev, nuevoCache].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setProductoSeleccionado(nuevoCache);
      setPrecio(nuevoCache.precioUnitario);
      setOrigenDeposito(false);
      setAgregandoProducto(false);
      setNombreProductoNuevo("");
      setVariedadProductoNuevo("");
      setTipoStockProductoNuevo("libre");
      setPrecioProductoNuevo("");
      setStockInicialProductoNuevo("");
    } catch {
      setErrorProductoNuevo("No se pudo agregar (¿sin conexión?). Probá de nuevo cuando haya señal, o cargalo más tarde desde Productos.");
    } finally {
      setGuardandoProducto(false);
    }
  }

  useEffect(() => {
    (async () => {
      await refrescarPagados();
      await refrescarMisPedidos();
    })();
    const interval = setInterval(() => {
      refrescarPagados();
      refrescarMisPedidos();
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mostrarTodosPagados]);

  function agregarItem() {
    if (!productoSeleccionado || !cantidad || !precio) return;
    if (Number(cantidad) <= 0 || Number(precio) <= 0) {
      alert("La cantidad y el precio tienen que ser mayores a cero.");
      return;
    }
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
    if (items.length === 0 || confirmando) return;
    setConfirmando(true);
    try {
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

      await refrescarMisPedidos();
      sincronizarTodo().then(refrescarMisPedidos);
    } finally {
      setConfirmando(false);
    }
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
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium">Cliente</label>
          <button
            type="button"
            className="text-xs underline text-neutral-500"
            onClick={() => {
              setAgregandoCliente(true);
              setErrorClienteNuevo(null);
            }}
          >
            + Cliente nuevo
          </button>
        </div>
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

        {agregandoCliente && (
          <div className="border rounded-lg p-3 mt-2 bg-card flex flex-col gap-2">
            <label className="text-sm font-medium">Nombre del cliente nuevo</label>
            <div className="flex gap-2">
              <Input
                value={nombreClienteNuevo}
                onChange={(e) => setNombreClienteNuevo(e.target.value)}
                placeholder="Ej. Juan Pérez"
                autoFocus
              />
              <Button onClick={agregarClienteRapido} disabled={guardandoCliente || !nombreClienteNuevo.trim()}>
                Agregar
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setAgregandoCliente(false);
                  setNombreClienteNuevo("");
                  setErrorClienteNuevo(null);
                }}
              >
                Cancelar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Se agrega solo con el nombre — el resto de los datos se puede completar después desde
              Clientes.
            </p>
            {errorClienteNuevo && <p className="text-sm text-red-600">{errorClienteNuevo}</p>}
          </div>
        )}
      </div>

      <div className="border rounded-lg p-3 flex flex-col gap-3 bg-card">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Agregar producto</label>
          <button
            type="button"
            className="text-xs underline text-neutral-500"
            onClick={() => {
              setAgregandoProducto(true);
              setErrorProductoNuevo(null);
            }}
          >
            + Producto nuevo
          </button>
        </div>
        <ProductoAutocomplete
          productos={productos}
          onSeleccionar={(p) => {
            setProductoSeleccionado(p);
            setPrecio(p.precioUnitario);
            setOrigenDeposito(false);
          }}
        />

        {agregandoProducto && (
          <div className="border rounded-lg p-3 bg-card flex flex-col gap-2">
            <label className="text-sm font-medium">Producto nuevo</label>
            <div className="flex gap-2">
              <Input
                value={nombreProductoNuevo}
                onChange={(e) => setNombreProductoNuevo(e.target.value)}
                placeholder="Nombre (ej. Banana)"
                autoFocus
                className="flex-1"
              />
              <Input
                value={variedadProductoNuevo}
                onChange={(e) => setVariedadProductoNuevo(e.target.value)}
                placeholder="Variedad (opcional)"
                className="flex-1"
              />
            </div>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-xs">Tipo de stock</label>
                <Select
                  value={tipoStockProductoNuevo}
                  onValueChange={(v) =>
                    setTipoStockProductoNuevo((v ?? "libre") as "libre" | "controlado")
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(value: string | null) =>
                        value === "controlado" ? "Con stock (depósito)" : "Sin stock"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="libre">Sin stock</SelectItem>
                    <SelectItem value="controlado">Con stock (depósito)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-28">
                <label className="text-xs">Precio</label>
                <Input
                  type="number"
                  min="0"
                  value={precioProductoNuevo}
                  onChange={(e) => setPrecioProductoNuevo(e.target.value)}
                />
              </div>
              {tipoStockProductoNuevo === "controlado" && (
                <div className="w-32">
                  <label className="text-xs">Stock inicial</label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="Opcional"
                    value={stockInicialProductoNuevo}
                    onChange={(e) => setStockInicialProductoNuevo(e.target.value)}
                  />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={agregarProductoRapido}
                disabled={guardandoProducto || !nombreProductoNuevo.trim() || !precioProductoNuevo}
              >
                Agregar
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setAgregandoProducto(false);
                  setNombreProductoNuevo("");
                  setVariedadProductoNuevo("");
                  setTipoStockProductoNuevo("libre");
                  setPrecioProductoNuevo("");
                  setStockInicialProductoNuevo("");
                  setErrorProductoNuevo(null);
                }}
              >
                Cancelar
              </Button>
            </div>
            {errorProductoNuevo && <p className="text-sm text-red-600">{errorProductoNuevo}</p>}
          </div>
        )}

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
        <Button size="lg" disabled={items.length === 0 || confirmando} onClick={confirmarPedido}>
          {confirmando ? "Confirmando..." : "Confirmar pedido e imprimir"}
        </Button>
      </div>

      <div className="text-xs text-neutral-400 text-center">
        Fecha: {hoyLocal()}
        {!online && " · Sin conexión: el pedido se guarda igual y se sincroniza solo"}
      </div>

      {pedidosPagados.length > 0 && (
        <div className="border-t pt-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium">
              {mostrarTodosPagados ? "Pedidos pagados hoy" : "Últimos 5 pedidos pagados hoy"}
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

      {misPedidos.length > 0 && (
        <div className="border-t pt-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium">Mis pedidos en este dispositivo</h2>
            <button
              className="text-xs underline text-neutral-500"
              onClick={() => setMostrarMisPedidos((v) => !v)}
            >
              {mostrarMisPedidos ? "Ocultar" : "Mostrar"}
            </button>
          </div>
          {mostrarMisPedidos && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {misPedidos.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>Nº {String(p.numeroPedido).padStart(3, "0")}</TableCell>
                    <TableCell className="text-right">${p.total}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          p.syncStatus === "error"
                            ? "destructive"
                            : p.syncStatus === "sincronizado"
                              ? "default"
                              : "secondary"
                        }
                      >
                        {p.syncStatus === "error"
                          ? "No se pudo enviar"
                          : p.syncStatus === "sincronizado"
                            ? "Sincronizado"
                            : "Por sincronizar"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {p.syncStatus === "error" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={reintentandoId === p.id}
                          onClick={() => reintentarPedido(p)}
                        >
                          Reintentar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </main>
  );
}
