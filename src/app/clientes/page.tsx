"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  listarClientes,
  crearCliente,
  actualizarCliente,
  darDeBajaCliente,
} from "@/lib/actions/clientes";
import { getUsuario, getDispositivoId } from "@/lib/session";
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

type Cliente = Awaited<ReturnType<typeof listarClientes>>[number];

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [nombre, setNombre] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);

  async function refrescar() {
    setClientes(await listarClientes(false));
  }

  useEffect(() => {
    (async () => {
      await refrescar();
    })();
  }, []);

  async function guardar() {
    if (!nombre) return;
    const usuario = getUsuario() || "admin";
    const dispositivo = getDispositivoId();
    if (editandoId) {
      await actualizarCliente({ id: editandoId, nombre, usuario, dispositivo });
    } else {
      await crearCliente({ nombre, usuario, dispositivo });
    }
    setNombre("");
    setEditandoId(null);
    refrescar();
  }

  function editar(c: Cliente) {
    setEditandoId(c.id);
    setNombre(c.nombre);
  }

  async function baja(c: Cliente) {
    if (!window.confirm(`¿Dar de baja a "${c.nombre}"?`)) return;
    await darDeBajaCliente({ id: c.id, usuario: getUsuario() || "admin", dispositivo: getDispositivoId() });
    refrescar();
  }

  return (
    <main className="flex-1 flex flex-col gap-4 p-4 max-w-2xl mx-auto w-full">
      <h1 className="text-xl font-bold">Clientes</h1>

      <div className="border rounded-lg p-4 bg-card flex gap-3">
        <Input
          placeholder="Nombre del cliente"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <Button onClick={guardar}>{editandoId ? "Guardar" : "Agregar"}</Button>
        {editandoId && (
          <Button
            variant="outline"
            onClick={() => {
              setEditandoId(null);
              setNombre("");
            }}
          >
            Cancelar
          </Button>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clientes.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-mono text-xs">{c.codigo}</TableCell>
              <TableCell>{c.nombre}</TableCell>
              <TableCell>
                <Badge variant={c.activo ? "default" : "secondary"}>
                  {c.activo ? "Activo" : "Baja"}
                </Badge>
              </TableCell>
              <TableCell className="flex gap-2">
                <button className="text-xs underline" onClick={() => editar(c)}>
                  editar
                </button>
                {c.activo && (
                  <button className="text-xs text-red-500 underline" onClick={() => baja(c)}>
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
