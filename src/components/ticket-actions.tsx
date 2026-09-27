"use client";

import { useRef } from "react";
import { Ticket, type TicketProps } from "./ticket";
import { EstiloImpresion } from "./estilo-impresion";
import { Button } from "@/components/ui/button";
import { useExportarImagen } from "@/lib/use-exportar-imagen";

export function TicketConAcciones(props: TicketProps) {
  const ref = useRef<HTMLDivElement>(null);
  const nombreArchivo = `pedido-${String(props.numeroPedido).padStart(3, "0")}`;
  const { descargar, compartir, generando } = useExportarImagen(ref, nombreArchivo);

  return (
    <div className="flex flex-col items-center gap-3">
      <EstiloImpresion tamano="A5" />
      <div className="imprimible">
        <Ticket ref={ref} {...props} />
      </div>
      <div className="flex gap-2 flex-wrap justify-center">
        <Button onClick={descargar} disabled={generando} variant="outline">
          Descargar JPG
        </Button>
        <Button onClick={() => compartir(`Pedido Nº ${props.numeroPedido}`)} disabled={generando}>
          Compartir por WhatsApp
        </Button>
        <Button onClick={() => window.print()} variant="outline">
          Imprimir
        </Button>
      </div>
    </div>
  );
}
