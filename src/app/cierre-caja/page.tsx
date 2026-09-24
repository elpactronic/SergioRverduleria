"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BotonVolver } from "@/components/boton-volver";
import { obtenerCierreDeCaja, type CierreDeCaja } from "@/lib/actions/caja";
import { CierreCajaConAcciones } from "@/components/cierre-caja-acciones";
import { Input } from "@/components/ui/input";

function hoyLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export default function CierreCajaPage() {
  const [fecha, setFecha] = useState(hoyLocal());
  const [cierre, setCierre] = useState<CierreDeCaja | null>(null);
  const [cargando, setCargando] = useState(true);

  async function cargar() {
    setCargando(true);
    try {
      setCierre(await obtenerCierreDeCaja(fecha));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    (async () => {
      await cargar();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha]);

  return (
    <main className="flex-1 flex flex-col gap-4 p-4 max-w-2xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BotonVolver mensaje="¿Salir de cierre de caja?" />
          <h1 className="text-xl font-bold">Cierre de caja</h1>
        </div>
        <div className="w-44">
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
      </div>

      {cargando && <p className="text-sm text-muted-foreground">Calculando...</p>}

      {!cargando && cierre && (
        <div className="border rounded-lg p-4 bg-card flex flex-col items-center gap-4">
          <CierreCajaConAcciones {...cierre} />
        </div>
      )}

      <Link href="/" className="text-sm underline text-neutral-500">
        Volver al inicio
      </Link>
    </main>
  );
}
