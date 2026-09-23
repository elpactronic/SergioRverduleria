"use client";

import { useEffect, useState } from "react";
import { db, type CobroLocal } from "@/lib/offline/db";
import { sincronizarTodo } from "@/lib/offline/sync";
import { getDispositivoId, getUsuario } from "@/lib/session";
import { listarPedidosRecientes } from "@/lib/actions/pedidos";
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

const estadoPedidoLabel: Record<string, { texto: string; variant: "default" | "secondary" | "destructive" }> = {
  creado: { texto: "Pendiente de cobro", variant: "secondary" },
  cobrado: { texto: "Cobrado", variant: "default" },
  cancelado: { texto: "Cancelado", variant: "destructive" },
};

export default function CajaPage() {
  const [numeroPedido, setNumeroPedido] = useState("");
  const [fecha, setFecha] = useState(hoyLocal());
  const [monto, setMonto] = useState("");
  const [cobros, setCobros] = useState<CobroLocal[]>([]);
  const [pedidosRecientes, setPedidosRecientes] = useState<PedidoReciente[]>([]);
  const [mostrarTodosPedidos, setMostrarTodosPedidos] = useState(false);

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

  async function registrarCobro() {
    const numero = parseInt(numeroPedido, 10);
    if (!numero || !monto) return;

    await db.cobrosPendientes.add({
      id: crypto.randomUUID(),
      pedidoNumero: numero,
      pedidoFecha: fecha,
      cajeroId: getUsuario() || "C1",
      dispositivoId: getDispositivoId(),
      monto,
      registradoEn: new Date().toISOString(),
      syncStatus: "pendiente",
    });

    setNumeroPedido("");
    setMonto("");
    await refrescarCobros();
    sincronizarTodo().then(() => {
      refrescarCobros();
      refrescarPedidos();
    });
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

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
