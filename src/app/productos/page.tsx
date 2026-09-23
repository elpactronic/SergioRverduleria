"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  listarProductos,
  crearProducto,
  actualizarProducto,
  darDeBajaProducto,
} from "@/lib/actions/productos";
import { guardarApertura } from "@/lib/actions/deposito";
import { getUsuario, getDispositivoId } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

type Producto = Awaited<ReturnType<typeof listarProductos>>[number];

function hoyLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export default function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [nombre, setNombre] = useState("");
  const [variedad, setVariedad] = useState("");
  const [tipoStock, setTipoStock] = useState<"libre" | "controlado">("libre");
  const [precio, setPrecio] = useState("");
  const [stockInicial, setStockInicial] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);

  async function refrescar() {
    setProductos(await listarProductos(false));
  }

  useEffect(() => {
    (async () => {
      await refrescar();
    })();
  }, []);

  function limpiar() {
    setNombre("");
    setVariedad("");
    setTipoStock("libre");
    setPrecio("");
    setStockInicial("");
    setEditandoId(null);
  }

  async function guardar() {
    if (!nombre || !precio) return;
    const usuario = getUsuario() || "admin";
    const dispositivo = getDispositivoId();
    let productoId = editandoId;

    if (editandoId) {
      await actualizarProducto({
        id: editandoId,
        nombre,
        variedad,
        tipoStock,
        precioUnitario: precio,
        usuario,
        dispositivo,
      });
    } else {
      const creado = await crearProducto({
        nombre,
        variedad,
        tipoStock,
        precioUnitario: precio,
        usuario,
        dispositivo,
      });
      productoId = creado.id;
    }

    if (tipoStock === "controlado" && stockInicial.trim() !== "" && productoId) {
      await guardarApertura({
        fecha: hoyLocal(),
        items: [{ productoId, cantidadInicial: stockInicial }],
        usuario,
        dispositivo,
      });
    }

    limpiar();
    refrescar();
  }

  function editar(p: Producto) {
    setEditandoId(p.id);
    setNombre(p.nombre);
    setVariedad(p.variedad ?? "");
    setTipoStock(p.tipoStock);
    setPrecio(p.precioUnitario);
    setStockInicial("");
  }

  async function baja(id: string) {
    await darDeBajaProducto({ id, usuario: getUsuario() || "admin", dispositivo: getDispositivoId() });
    refrescar();
  }

  return (
    <main className="flex-1 flex flex-col gap-4 p-4 max-w-3xl mx-auto w-full">
      <h1 className="text-xl font-bold">Productos</h1>

      <div className="border rounded-lg p-4 bg-card flex flex-col gap-3">
        <div className="flex gap-3">
          <Input placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <Input
            placeholder="Variedad (opcional)"
            value={variedad}
            onChange={(e) => setVariedad(e.target.value)}
          />
        </div>
        <div className="flex gap-3">
          <Select
            value={tipoStock}
            onValueChange={(v) => setTipoStock((v ?? "libre") as "libre" | "controlado")}
          >
            <SelectTrigger className="w-48">
              <SelectValue>
                {(value: string | null) =>
                  value === "controlado" ? "Con stock controlado (depósito)" : "Sin stock controlado"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="libre">Sin stock controlado</SelectItem>
              <SelectItem value="controlado">Con stock controlado (depósito)</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="number"
            placeholder="Precio unitario por bulto"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
          />
        </div>
        {tipoStock === "controlado" && (
          <div>
            <label className="text-xs text-neutral-500 mb-1 block">
              Stock inicial en depósito hoy ({hoyLocal()}) — opcional, se puede cargar
              después desde Depósito
            </label>
            <Input
              type="number"
              min="0"
              placeholder="Cantidad de bultos"
              value={stockInicial}
              onChange={(e) => setStockInicial(e.target.value)}
              className="w-56"
            />
          </div>
        )}
        <div className="flex gap-2">
          <Button onClick={guardar}>{editandoId ? "Guardar cambios" : "Agregar producto"}</Button>
          {editandoId && (
            <Button variant="outline" onClick={limpiar}>
              Cancelar
            </Button>
          )}
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="text-right">Precio</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {productos.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-mono text-xs">{p.codigo}</TableCell>
              <TableCell>
                {p.nombre}
                {p.variedad ? ` — ${p.variedad}` : ""}
              </TableCell>
              <TableCell>
                {p.tipoStock === "controlado" ? "Depósito" : "Sin control"}
              </TableCell>
              <TableCell className="text-right">${p.precioUnitario}</TableCell>
              <TableCell>
                <Badge variant={p.activo ? "default" : "secondary"}>
                  {p.activo ? "Activo" : "Baja"}
                </Badge>
              </TableCell>
              <TableCell className="flex gap-2">
                <button className="text-xs underline" onClick={() => editar(p)}>
                  editar
                </button>
                {p.activo && (
                  <button className="text-xs text-red-500 underline" onClick={() => baja(p.id)}>
                    dar de baja
                  </button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Link href="/" className="text-sm underline text-neutral-500">
        Volver al inicio
      </Link>
    </main>
  );
}
