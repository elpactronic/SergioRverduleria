"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  listarProductosControlados,
  obtenerApertura,
  guardarApertura,
  registrarMovimiento,
  guardarConteoFisico,
  obtenerReporte,
  type FilaReporte,
} from "@/lib/actions/deposito";
import { getUsuario, getDispositivoId } from "@/lib/session";
import { ReporteDepositoConAcciones } from "@/components/reporte-deposito-acciones";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type ProductoControlado = Awaited<ReturnType<typeof listarProductosControlados>>[number];

function hoyLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export default function DepositoPage() {
  const [fecha, setFecha] = useState(hoyLocal());
  const [productos, setProductos] = useState<ProductoControlado[]>([]);
  const [apertura, setApertura] = useState<Record<string, string>>({});
  const [reporte, setReporte] = useState<FilaReporte[] | null>(null);
  const [fisico, setFisico] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);

  const [movProductoId, setMovProductoId] = useState("");
  const [movTipo, setMovTipo] = useState<"entrada" | "ajuste">("entrada");
  const [movCantidad, setMovCantidad] = useState("");
  const [movMotivo, setMovMotivo] = useState("");

  async function cargarTodo() {
    const [prods, aperturaFecha] = await Promise.all([
      listarProductosControlados(),
      obtenerApertura(fecha),
    ]);
    setProductos(prods);
    const mapa: Record<string, string> = {};
    for (const a of aperturaFecha) mapa[a.productoId] = a.cantidadInicial;
    setApertura(mapa);
  }

  async function cargarReporte() {
    const filas = await obtenerReporte(fecha);
    setReporte(filas);
    const mapaFisico: Record<string, string> = {};
    for (const f of filas) if (f.fisico !== null) mapaFisico[f.productoId] = String(f.fisico);
    setFisico(mapaFisico);
  }

  useEffect(() => {
    (async () => {
      await cargarTodo();
      await cargarReporte();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha]);

  async function guardarAperturaDelDia() {
    const items = Object.entries(apertura)
      .filter(([, cant]) => cant !== "" && cant !== undefined)
      .map(([productoId, cantidadInicial]) => ({ productoId, cantidadInicial }));
    if (items.length === 0) return;

    setGuardando(true);
    try {
      await guardarApertura({
        fecha,
        items,
        usuario: getUsuario() || "admin",
        dispositivo: getDispositivoId(),
      });
      await cargarReporte();
    } finally {
      setGuardando(false);
    }
  }

  async function registrarMovimientoManual() {
    if (!movProductoId || !movCantidad) return;
    await registrarMovimiento({
      productoId: movProductoId,
      tipo: movTipo,
      cantidad: movCantidad,
      motivo: movMotivo || undefined,
      usuario: getUsuario() || "admin",
      dispositivo: getDispositivoId(),
    });
    setMovProductoId("");
    setMovCantidad("");
    setMovMotivo("");
    await cargarReporte();
  }

  async function guardarConteo() {
    const items = Object.entries(fisico)
      .filter(([, cant]) => cant !== "" && cant !== undefined)
      .map(([productoId, cantidadContada]) => ({ productoId, cantidadContada }));
    if (items.length === 0) return;

    setGuardando(true);
    try {
      await guardarConteoFisico({
        fecha,
        items,
        usuario: getUsuario() || "admin",
        dispositivo: getDispositivoId(),
      });
      await cargarReporte();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <main className="flex-1 flex flex-col gap-6 p-4 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Depósito</h1>
        <div className="w-44">
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
      </div>

      {/* Apertura del día */}
      <section className="border rounded-lg p-4 bg-white flex flex-col gap-3">
        <h2 className="font-semibold">Apertura del día</h2>
        {productos.length === 0 && (
          <p className="text-sm text-neutral-500">
            No hay productos con stock controlado. Marcalos en la sección de Productos.
          </p>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead className="w-40">Cantidad inicial</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {productos.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  {p.nombre}
                  {p.variedad ? ` — ${p.variedad}` : ""}
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min="0"
                    value={apertura[p.id] ?? ""}
                    onChange={(e) =>
                      setApertura((prev) => ({ ...prev, [p.id]: e.target.value }))
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {productos.length > 0 && (
          <Button onClick={guardarAperturaDelDia} disabled={guardando} className="self-start">
            Guardar apertura
          </Button>
        )}
      </section>

      {/* Movimiento manual */}
      <section className="border rounded-lg p-4 bg-white flex flex-col gap-3">
        <h2 className="font-semibold">Registrar entrada o ajuste</h2>
        <div className="flex gap-3 flex-wrap items-end">
          <div className="w-56">
            <label className="text-xs">Producto</label>
            <Select value={movProductoId} onValueChange={(v) => setMovProductoId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar">
                  {(value: string | null) => {
                    const p = productos.find((pr) => pr.id === value);
                    return p ? `${p.nombre}${p.variedad ? " — " + p.variedad : ""}` : "Seleccionar";
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {productos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre}
                    {p.variedad ? ` — ${p.variedad}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-36">
            <label className="text-xs">Tipo</label>
            <Select
              value={movTipo}
              onValueChange={(v) => setMovTipo((v ?? "entrada") as "entrada" | "ajuste")}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value: string | null) => (value === "ajuste" ? "Ajuste (+/-)" : "Entrada")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="entrada">Entrada</SelectItem>
                <SelectItem value="ajuste">Ajuste (+/-)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-28">
            <label className="text-xs">Cantidad</label>
            <Input
              type="number"
              value={movCantidad}
              onChange={(e) => setMovCantidad(e.target.value)}
            />
          </div>
          <div className="flex-1 min-w-40">
            <label className="text-xs">Motivo (opcional)</label>
            <Input value={movMotivo} onChange={(e) => setMovMotivo(e.target.value)} />
          </div>
          <Button onClick={registrarMovimientoManual}>Registrar</Button>
        </div>
      </section>

      {/* Reporte */}
      <section className="border rounded-lg p-4 bg-white flex flex-col gap-3">
        <h2 className="font-semibold">Reporte del día</h2>
        {reporte && reporte.length > 0 ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Apertura</TableHead>
                  <TableHead className="text-right">Entradas</TableHead>
                  <TableHead className="text-right">Devol.</TableHead>
                  <TableHead className="text-right">Salidas</TableHead>
                  <TableHead className="text-right">Ajustes</TableHead>
                  <TableHead className="text-right">Teórico</TableHead>
                  <TableHead className="w-28">Físico</TableHead>
                  <TableHead className="text-right">Dif.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reporte.map((f) => (
                  <TableRow key={f.productoId}>
                    <TableCell>
                      {f.nombre}
                      {f.variedad ? ` — ${f.variedad}` : ""}
                    </TableCell>
                    <TableCell className="text-right">{f.apertura}</TableCell>
                    <TableCell className="text-right">{f.entradas}</TableCell>
                    <TableCell className="text-right">{f.devoluciones}</TableCell>
                    <TableCell className="text-right">{f.salidas}</TableCell>
                    <TableCell className="text-right">{f.ajustes}</TableCell>
                    <TableCell className="text-right font-semibold">{f.teorico}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={fisico[f.productoId] ?? ""}
                        onChange={(e) =>
                          setFisico((prev) => ({ ...prev, [f.productoId]: e.target.value }))
                        }
                      />
                    </TableCell>
                    <TableCell
                      className={`text-right ${
                        f.diferencia && f.diferencia !== 0 ? "text-red-600 font-semibold" : ""
                      }`}
                    >
                      {f.diferencia ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Button onClick={guardarConteo} disabled={guardando} className="self-start">
              Guardar conteo físico
            </Button>

            <div className="pt-2 border-t">
              <ReporteDepositoConAcciones fecha={fecha} filas={reporte} />
            </div>
          </>
        ) : (
          <p className="text-sm text-neutral-500">
            No hay productos con stock controlado para reportar.
          </p>
        )}
      </section>

      <Link href="/" className="text-sm underline text-neutral-500">
        Volver al inicio
      </Link>
    </main>
  );
}
