"use client";

import { useRef } from "react";
import { ReporteCierreCaja } from "./cierre-caja";
import { EstiloImpresion } from "./estilo-impresion";
import type { CierreDeCaja } from "@/lib/actions/caja";
import { Button } from "@/components/ui/button";
import { useExportarImagen } from "@/lib/use-exportar-imagen";

export function CierreCajaConAcciones(props: CierreDeCaja) {
  const ref = useRef<HTMLDivElement>(null);
  const nombreArchivo = `cierre-caja-${props.fecha}`;
  const { descargar, compartir, generando } = useExportarImagen(ref, nombreArchivo);

  return (
    <div className="flex flex-col items-center gap-3">
      <EstiloImpresion tamano="A4" />
      <div className="imprimible">
        <ReporteCierreCaja ref={ref} {...props} />
      </div>
      <div className="flex gap-2 flex-wrap justify-center">
        <Button onClick={descargar} disabled={generando} variant="outline">
          Descargar imagen
        </Button>
        <Button onClick={() => compartir(`Cierre de caja ${props.fecha}`)} disabled={generando}>
          Compartir por WhatsApp
        </Button>
        <Button onClick={() => window.print()} variant="outline">
          Imprimir
        </Button>
      </div>
    </div>
  );
}
