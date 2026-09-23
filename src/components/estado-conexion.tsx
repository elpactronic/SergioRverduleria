"use client";

import { useEffect, useState } from "react";
import { useSync } from "@/lib/offline/use-sync";
import { db } from "@/lib/offline/db";
import { Badge } from "@/components/ui/badge";

export function EstadoConexion() {
  const { online } = useSync();
  const [pendientes, setPendientes] = useState(0);

  useEffect(() => {
    const actualizar = async () => {
      const [p1, p2] = await Promise.all([
        db.pedidosPendientes.where("syncStatus").equals("pendiente").count(),
        db.cobrosPendientes.where("syncStatus").equals("pendiente").count(),
      ]);
      setPendientes(p1 + p2);
    };
    actualizar();
    const interval = setInterval(actualizar, 5000);
    return () => clearInterval(interval);
  }, [online]);

  return (
    <div className="flex items-center gap-2">
      <Badge variant={online ? "default" : "destructive"}>
        {online ? "En línea" : "Sin conexión"}
      </Badge>
      {pendientes > 0 && <Badge variant="secondary">{pendientes} por sincronizar</Badge>}
    </div>
  );
}
