"use client";

import { useRef, useState } from "react";
import { toJpeg } from "html-to-image";
import { Ticket, type TicketProps } from "./ticket";
import { Button } from "@/components/ui/button";

export function TicketConAcciones(props: TicketProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [generando, setGenerando] = useState(false);

  async function generarBlob(): Promise<Blob | null> {
    if (!ref.current) return null;
    const dataUrl = await toJpeg(ref.current, { quality: 0.95, backgroundColor: "#ffffff" });
    const res = await fetch(dataUrl);
    return res.blob();
  }

  async function descargar() {
    setGenerando(true);
    try {
      const blob = await generarBlob();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pedido-${String(props.numeroPedido).padStart(3, "0")}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setGenerando(false);
    }
  }

  async function compartir() {
    setGenerando(true);
    try {
      const blob = await generarBlob();
      if (!blob) return;
      const file = new File(
        [blob],
        `pedido-${String(props.numeroPedido).padStart(3, "0")}.jpg`,
        { type: "image/jpeg" },
      );

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Pedido Nº ${props.numeroPedido}`,
        });
      } else {
        await descargar();
      }
    } finally {
      setGenerando(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <Ticket ref={ref} {...props} />
      <div className="flex gap-2">
        <Button onClick={descargar} disabled={generando} variant="outline">
          Descargar JPG
        </Button>
        <Button onClick={compartir} disabled={generando}>
          Compartir por WhatsApp
        </Button>
      </div>
    </div>
  );
}
