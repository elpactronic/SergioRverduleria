"use client";

import { useRef } from "react";
import { ReporteDeposito, type ReporteDepositoProps } from "./reporte-deposito";
import { Button } from "@/components/ui/button";
import { useExportarImagen } from "@/lib/use-exportar-imagen";

export function ReporteDepositoConAcciones(props: ReporteDepositoProps) {
  const ref = useRef<HTMLDivElement>(null);
  const nombreArchivo = `reporte-deposito-${props.fecha}`;
  const { descargar, compartir, generando } = useExportarImagen(ref, nombreArchivo);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="overflow-x-auto max-w-full">
        <ReporteDeposito ref={ref} {...props} />
      </div>
      <div className="flex gap-2">
        <Button onClick={descargar} disabled={generando} variant="outline">
          Descargar imagen
        </Button>
        <Button onClick={() => compartir(`Reporte de depósito ${props.fecha}`)} disabled={generando}>
          Compartir por WhatsApp
        </Button>
      </div>
    </div>
  );
}
