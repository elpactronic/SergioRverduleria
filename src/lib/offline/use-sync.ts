"use client";

import { useEffect, useState } from "react";
import { sincronizarTodo } from "./sync";

/** Dispara sincronización al montar, al reconectar, y cada 30s como respaldo. */
export function useSync() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    (async () => {
      setOnline(navigator.onLine);
      await sincronizarTodo();
    })();

    const onOnline = () => {
      setOnline(true);
      sincronizarTodo();
    };
    const onOffline = () => setOnline(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const interval = setInterval(sincronizarTodo, 30_000);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(interval);
    };
  }, []);

  return { online };
}
