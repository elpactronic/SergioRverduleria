"use client";

import { useEffect, useState } from "react";
import { db, type CobroLocal } from "@/lib/offline/db";
import { sincronizarTodo } from "@/lib/offline/sync";
import { getDispositivoId, getUsuario } from "@/lib/session";
import { listarPedidosRecientes, obtenerDetallePedido } from "@/lib/actions/pedidos";
import { EstadoConexion } from "@/components/estado-conexion";
import { BotonVolver } from "@/components/boton-volver";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function hoyLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

const estadoLabel: Record<CobroLocal["syncStatus"], { texto: string; variant: "default" | "secondary" | "destructive" }> = {
  pendiente: { texto: "Por sincronizar", variant: "secondary" },
  sincronizado: { texto: "Sincronizado", variant: "default" },
  error: { texto: "Error", variant: "destructive" },
};

type PedidoReciente = Awaited<ReturnType<typeof listarPedidosRecientes>>[number];
type DetallePedido = Awaited<ReturnType<typeof obtenerDetallePedido>>;

const estadoPedidoLabel: Record<string, { texto: string; variant: "default" | "secondary" | "destructive" }> = {
  creado: { texto: "Pendiente de cobro", variant: "secondary" },
  cobrado: { texto: "Cobrado", variant: "default" },
  retirado: { texto: "Retirado", variant: "secondary" },
  cancelado: { texto: "Cancelado", variant: "destructive" },
};

export default function CajaPage() {
  const [numeroPedido, setNumeroPedido] = useState("");
  const [fecha, setFecha] = useState(hoyLocal());
  const [monto, setMonto] = useState("");
  const [cobros, setCobros] = useState<CobroLocal[]>([]);
  const [pedidosRecientes, setPedidosRecientes] = useState<PedidoReciente[]>([]);
  const [mostrarTodosPedidos, setMostrarTodosPedidos] = useState(false);

  const [pedidoACobrar, setPedidoACobrar] = useState<PedidoReciente | null>(null);
  const [detallePedido, setDetallePedido] = useState<DetallePedido | null>(null);
  const [montoDialogo, setMontoDialogo] = useState("");
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  async function refrescarCobros() {
    const todos = await db.cobrosPendientes.orderBy("registradoEn").reverse().limit(20).toArray();
    setCobros(todos);
  }

  async function refrescarPedidos() {
    try {
      const limite = mostrarTodosPedidos ? 50 : 5;
      setPedidosRecientes(await listarPedidosRecientes(limite));
    } catch {
      // Sin conexión: se mantiene la última lista que se pudo traer.
    }
  }

  useEffect(() => {
    (async () => {
      await refrescarCobros();
      await refrescarPedidos();
    })();
    const interval = setInterval(() => {
      refrescarCobros();
      refrescarPedidos();
    }, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mostrarTodosPedidos]);

  async function procesarCobro(numero: number, fechaPedido: string, montoStr: string) {
    await db.cobrosPendientes.add({
      id: crypto.randomUUID(),
      pedidoNumero: numero,
      pedidoFecha: fechaPedido,
      cajeroId: getUsuario() || "C1",
      dispositivoId: getDispositivoId(),
      monto: montoStr,
      registradoEn: new Date().toISOString(),
      syncStatus: "pendiente",
    });

    await refrescarCobros();
    sincronizarTodo().then(() => {
      refrescarCobros();
      refrescarPedidos();
    });
  }

  async function registrarCobro() {
    const numero = parseInt(numeroPedido, 10);
    if (!numero || !monto) return;
    await procesarCobro(numero, fecha, monto);
    setNumeroPedido("");
    setMonto("");
  }

  async function abrirCobroDesdePedido(p: PedidoReciente) {
    setPedidoACobrar(p);
    setMontoDialogo(p.total);
    setDetallePedido(null);
    setCargandoDetalle(true);
    try {
      setDetallePedido(await obtenerDetallePedido(p.id));
    } finally {
      setCargandoDetalle(false);
    }
  }

  async function confirmarCobroDesdeDialogo() {
    if (!pedidoACobrar || !montoDialogo) return;
    setConfirmando(true);
    try {
      await procesarCobro(pedidoACobrar.numeroPedido, pedidoACobrar.fecha, montoDialogo);
      setPedidoACobrar(null);
    } finally {
      setConfirmando(false);
    }
  }

  return (
    <main className="flex-1 flex flex-col gap-4 p-4 max-w-2xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BotonVolver mensaje="¿Salir de caja? Se perderá el cobro que no registraste." />
          <h1 className="text-xl font-bold">Registrar cobro</h1>
        </div>
        <EstadoConexion />
      </div>

      <div className="border rounded-lg p-4 bg-white flex flex-col gap-3">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-sm font-medium mb-1 block">Nº de pedido</label>
            <Input
              inputMode="numeric"
              placeholder="Ej. 42"
              value={numeroPedido}
              onChange={(e) => setNumeroPedido(e.target.value)}
              className="text-lg"
              autoFocus
            />
          </div>
          <div className="w-36">
            <label className="text-sm font-medium mb-1 block">Fecha del pedido</label>
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Monto cobrado</label>
          <Input
            type="number"
            min="0"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
          />
        </div>
        <Button
          size="lg"
          disabled={!numeroPedido || !monto}
          onClick={registrarCobro}
        >
          Registrar cobro y autorizar retiro
        </Button>
      </div>

      {pedidosRecientes.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium">
              {mostrarTodosPedidos ? "Pedidos recientes" : "Últimos 5 pedidos"}
            </h2>
            <button
              className="text-xs underline text-neutral-500"
              onClick={() => setMostrarTodosPedidos((v) => !v)}
            >
              {mostrarTodosPedidos ? "Mostrar menos" : "Mostrar todos"}
            </button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Hora</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pedidosRecientes.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>Nº {String(p.numeroPedido).padStart(3, "0")}</TableCell>
                  <TableCell>{p.clienteNombre ?? "Consumidor final"}</TableCell>
                  <TableCell>
                    {new Date(p.creadoEn).toLocaleTimeString("es-AR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell className="text-right">${p.total}</TableCell>
                  <TableCell>
                    <Badge variant={estadoPedidoLabel[p.estado].variant}>
                      {estadoPedidoLabel[p.estado].texto}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {p.estado === "creado" && (
                      <Button size="sm" variant="outline" onClick={() => abrirCobroDesdePedido(p)}>
                        Cobrar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!pedidoACobrar} onOpenChange={(open) => !open && setPedidoACobrar(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Confirmar cobro — Pedido Nº {pedidoACobrar ? String(pedidoACobrar.numeroPedido).padStart(3, "0") : ""}
            </DialogTitle>
          </DialogHeader>

          {cargandoDetalle && <p className="text-sm text-neutral-500">Cargando pedido...</p>}

          {detallePedido && (
            <div className="flex flex-col gap-3">
              <div className="text-sm">
                <div>Cliente: {detallePedido.clienteNombre}</div>
                <div>Fecha: {detallePedido.fecha}</div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cant</TableHead>
                    <TableHead>Detalle</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detallePedido.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.cantidadBultos}</TableCell>
                      <TableCell>{item.detalle}</TableCell>
                      <TableCell className="text-right">${item.total}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div>
                <label className="text-sm font-medium mb-1 block">Monto a cobrar</label>
                <Input
                  type="number"
                  min="0"
                  value={montoDialogo}
                  onChange={(e) => setMontoDialogo(e.target.value)}
                  className="text-lg font-semibold"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPedidoACobrar(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmarCobroDesdeDialogo} disabled={confirmando || !montoDialogo}>
              Confirmar cobro y autorizar retiro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {cobros.length > 0 && (
        <div>
          <h2 className="text-sm font-medium mb-2">Últimos cobros de este dispositivo</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cobros.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>Nº {String(c.pedidoNumero).padStart(3, "0")}</TableCell>
                  <TableCell>{c.pedidoFecha}</TableCell>
                  <TableCell className="text-right">${c.monto}</TableCell>
                  <TableCell>
                    <Badge variant={estadoLabel[c.syncStatus].variant}>
                      {estadoLabel[c.syncStatus].texto}
                    </Badge>
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
