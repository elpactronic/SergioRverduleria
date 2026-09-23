"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import type { ProductoCache } from "@/lib/offline/db";

export function ProductoAutocomplete({
  productos,
  onSeleccionar,
}: {
  productos: ProductoCache[];
  onSeleccionar: (producto: ProductoCache) => void;
}) {
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);

  const filtrados = useMemo(() => {
    const q = texto.trim().toLowerCase();
    if (!q) return [];
    return productos
      .filter((p) =>
        `${p.nombre} ${p.variedad ?? ""}`.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [texto, productos]);

  return (
    <div className="relative">
      <Input
        placeholder="Escribí el producto (ej. manzana)..."
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
      />
      {abierto && filtrados.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full bg-white border rounded-md shadow-md max-h-64 overflow-auto">
          {filtrados.map((p) => (
            <li
              key={p.id}
              className="px-3 py-2 hover:bg-neutral-100 cursor-pointer text-sm flex justify-between"
              onMouseDown={() => {
                onSeleccionar(p);
                setTexto("");
                setAbierto(false);
              }}
            >
              <span>
                {p.nombre}
                {p.variedad ? ` — ${p.variedad}` : ""}
              </span>
              <span className="text-neutral-400">
                {p.tipoStock === "controlado" ? "depósito" : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
