"use client";

import { useEffect } from "react";

export function RegistrarServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Si falla el registro (ej. navegador sin soporte), la app sigue
        // funcionando online normalmente, solo sin el modo offline del shell.
      });
    }
  }, []);

  return null;
}
