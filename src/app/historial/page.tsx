"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BotonVolver } from "@/components/boton-volver";
import { buscarHistorial } from "@/lib/actions/historial";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type EventoAudit = Awaited<ReturnType<typeof buscarHistorial>>[number];

const ACCION_LABEL: Record<string, string> = {
  CREAR_PEDIDO: "Pedido creado",
  REGISTRAR_COBRO: "Cobro registrado",
  AUTORIZAR_RETIRO: "Cobro conciliado — autoriza el retiro",
  RETIRAR_PEDIDO: "Mercadería retirada",
  CANCELAR_PEDIDO: "Pedido cancelado",
  CANCELAR_COBRO: "Cobro cancelado (nunca se conciliò)",
};

const ACCION_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  CREAR_PEDIDO: "secondary",
  REGISTRAR_COBRO: "secondary",
  AUTORIZAR_RETIRO: "default",
  RETIRAR_PEDIDO: "default",
  CANCELAR_PEDIDO: "destructive",
  CANCELAR_COBRO: "destructive",
};

function hoyLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function fechaDe(fecha: Date | string) {
  return new Date(fecha).toISOString().slice(0, 10);
}

interface GrupoPedido {
  clave: string;
  numeroPedido: number;
  fecha: string;
  eventos: EventoAudit[];
}

function agrupar(eventos: EventoAudit[]): GrupoPedido[] {
  const mapa = new Map<string, GrupoPedido>();
  for (const e of eventos) {
    if (e.numeroPedido == null) continue;
    const fecha = fechaDe(e.timestamp);
    const clave = `${e.numeroPedido}-${fecha}`;
    if (!mapa.has(clave)) {
      mapa.set(clave, { clave, numeroPedido: e.numeroPedido, fecha, eventos: [] });
    }
    mapa.get(clave)!.eventos.push(e);
  }
  return Array.from(mapa.values()).sort((a, b) => (a.clave < b.clave ? 1 : -1));
}

export default function HistorialPage() {
  const [numeroPedido, setNumeroPedido] = useState("");
  const [fecha, setFecha] = useState(hoyLocal());
  const [eventos, setEventos] = useState<EventoAudit[] | null>(null);
  const [buscando, setBuscando] = useState(false);

  async function buscar() {
    setBuscando(true);
    try {
      const filas = await buscarHistorial({
        numeroPedido: numeroPedido ? parseInt(numeroPedido, 10) : undefined,
        fecha: fecha || undefined,
      });
      setEventos(filas);
    } finally {
      setBuscando(false);
    }
  }

  useEffect(() => {
    (async () => {
      await buscar();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grupos = eventos ? agrupar(eventos) : [];

  return (
    <main className="flex-1 flex flex-col gap-4 p-4 max-w-3xl mx-auto w-full">
      <div className="flex items-center gap-2">
        <BotonVolver mensaje="¿Salir de historial?" />
        <h1 className="text-xl font-bold">Historial de pedidos</h1>
      </div>

      <div className="border rounded-lg p-4 bg-card flex flex-wrap gap-3 items-end">
        <div className="w-40">
          <label className="text-sm font-medium mb-1 block">Nº de pedido</label>
          <Input
            inputMode="numeric"
            placeholder="Ej. 42 (opcional)"
            value={numeroPedido}
            onChange={(e) => setNumeroPedido(e.target.value)}
          />
        </div>
        <div className="w-44">
          <label className="text-sm font-medium mb-1 block">Fecha</label>
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <Button onClick={buscar} disabled={buscando}>
          Buscar
        </Button>
        <p className="text-xs text-muted-foreground w-full">
          Dejá la fecha vacía para buscar un número de pedido en cualquier día.
        </p>
      </div>

      {grupos.length === 0 && eventos !== null && (
        <p className="text-sm text-muted-foreground">No se encontró actividad con esos filtros.</p>
      )}

      <div className="flex flex-col gap-4">
        {grupos.map((g) => (
          <div key={g.clave} className="border rounded-lg p-4 bg-card">
            <div className="font-semibold mb-3">
              Pedido Nº {String(g.numeroPedido).padStart(3, "0")} — {g.fecha}
            </div>
            <ol className="flex flex-col gap-3">
              {g.eventos.map((e) => (
                <li key={e.id} className="flex gap-3 items-start">
                  <div className="text-xs text-muted-foreground w-20 shrink-0 pt-0.5">
                    {new Date(e.timestamp).toLocaleTimeString("es-AR", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </div>
                  <div className="flex-1">
                    <Badge variant={ACCION_VARIANT[e.accion] ?? "secondary"}>
                      {ACCION_LABEL[e.accion] ?? e.accion}
                    </Badge>
                    <div className="text-xs text-muted-foreground mt-1">
                      Usuario: {e.usuario}
                      {e.dispositivo ? ` · Dispositivo: ${e.dispositivo.slice(0, 8)}…` : ""}
                    </div>
                    {e.infoAdicional != null &&
                      typeof e.infoAdicional === "object" &&
                      "motivo" in (e.infoAdicional as Record<string, unknown>) && (
                        <div className="text-xs mt-1 italic">
                          Motivo: {String((e.infoAdicional as Record<string, unknown>).motivo)}
                        </div>
                      )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      <Link href="/" className="text-sm underline text-neutral-500">
        Volver al inicio
      </Link>
    </main>
  );
}
