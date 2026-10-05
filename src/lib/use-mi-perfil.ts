"use client";

import { useEffect, useState } from "react";
import { obtenerMiPerfil } from "@/lib/actions/usuarios";
import type { Rol } from "@/lib/roles";

/**
 * Nombre real de quien está logueado ahora (según Clerk + la tabla de
 * usuarios permitidos), para reemplazar el viejo "V1"/"C1" autoreportado
 * como "usuario" en pedidos, cobros y auditoría. Si por algo falla la
 * consulta, devuelve "" y quien llama cae en su propio respaldo.
 */
export function useMiPerfil(): { nombre: string; rol: Rol | null } {
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState<Rol | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const perfil = await obtenerMiPerfil();
        if (perfil) {
          setNombre(perfil.nombre);
          setRol(perfil.rol as Rol);
        }
      } catch {
        // Sin conexión u otro problema: queda "" y el que llama usa su respaldo.
      }
    })();
  }, []);

  return { nombre, rol };
}
