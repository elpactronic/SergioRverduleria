"use client";

import { useState, type RefObject } from "react";
import { toJpeg } from "html-to-image";

export function useExportarImagen(ref: RefObject<HTMLElement | null>, nombreArchivo: string) {
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
      a.download = `${nombreArchivo}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setGenerando(false);
    }
  }

  async function compartir(titulo: string) {
    setGenerando(true);
    try {
      const blob = await generarBlob();
      if (!blob) return;
      const file = new File([blob], `${nombreArchivo}.jpg`, { type: "image/jpeg" });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: titulo });
      } else {
        await descargar();
      }
    } finally {
      setGenerando(false);
    }
  }

  return { descargar, compartir, generando };
}
