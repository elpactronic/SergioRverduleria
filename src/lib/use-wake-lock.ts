"use client";

import { useEffect } from "react";

/**
 * Evita que la pantalla del celular se suspenda mientras esta pantalla está
 * abierta (Vendedor/Caja se usan sobre todo desde el teléfono durante todo
 * un turno). El navegador libera el wake lock solo cuando la pestaña deja de
 * estar visible, así que hay que volver a pedirlo al recuperar el foco.
 * Si el navegador no soporta la API, no hace nada (no rompe nada tampoco).
 */
export function useWakeLock() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    let lock: WakeLockSentinel | null = null;

    async function pedir() {
      try {
        lock = await (navigator as Navigator & { wakeLock: WakeLock }).wakeLock.request("screen");
      } catch {
        // Puede fallar si la pestaña no está visible o el navegador lo niega: no es crítico.
      }
    }

    function alVolverVisible() {
      if (document.visibilityState === "visible") {
        pedir();
      }
    }

    pedir();
    document.addEventListener("visibilitychange", alVolverVisible);

    return () => {
      document.removeEventListener("visibilitychange", alVolverVisible);
      lock?.release().catch(() => {});
    };
  }, []);
}

interface WakeLockSentinel {
  release: () => Promise<void>;
}

interface WakeLock {
  request: (type: "screen") => Promise<WakeLockSentinel>;
}
