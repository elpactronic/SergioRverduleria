"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function BotonVolver({
  mensaje = "¿Salir de esta pantalla? Se perderá lo que no confirmaste.",
}: {
  mensaje?: string;
}) {
  const router = useRouter();

  function salir() {
    if (window.confirm(mensaje)) {
      router.push("/");
    }
  }

  return (
    <button
      type="button"
      onClick={salir}
      aria-label="Volver al inicio"
      className="p-1.5 -ml-1.5 rounded-md text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
    >
      <ArrowLeft className="size-5" />
    </button>
  );
}
