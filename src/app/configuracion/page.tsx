"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BotonVolver } from "@/components/boton-volver";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PALETAS,
  getModo,
  getPaleta,
  getFondoPersonalizado,
  setModo,
  setPaleta,
  setFondoPersonalizado,
  type Modo,
  type Paleta,
} from "@/lib/tema";
import { cambiarPin } from "@/lib/actions/configuracion";
import { getUsuario, getDispositivoId } from "@/lib/session";

const MODOS: { id: Modo; nombre: string }[] = [
  { id: "claro", nombre: "Claro" },
  { id: "oscuro", nombre: "Oscuro" },
  { id: "sistema", nombre: "Automático (según el dispositivo)" },
];

export default function ConfiguracionPage() {
  const [modo, setModoState] = useState<Modo>("sistema");
  const [paleta, setPaletaState] = useState<Paleta>("neutro");
  const [fondo, setFondoState] = useState("");

  useEffect(() => {
    (() => {
      setModoState(getModo());
      setPaletaState(getPaleta());
      setFondoState(getFondoPersonalizado() ?? "");
    })();
  }, []);

  function elegirModo(m: Modo) {
    setModo(m);
    setModoState(m);
  }

  function elegirPaleta(p: Paleta) {
    setPaleta(p);
    setPaletaState(p);
    setFondoState("");
  }

  function aplicarFondoPersonalizado(color: string) {
    setFondoState(color);
    setFondoPersonalizado(color);
  }

  function quitarFondoPersonalizado() {
    setFondoState("");
    setFondoPersonalizado(null);
  }

  const [pinActual, setPinActual] = useState("");
  const [pinNuevo, setPinNuevo] = useState("");
  const [pinConfirmar, setPinConfirmar] = useState("");
  const [cambiandoPin, setCambiandoPin] = useState(false);
  const [errorPin, setErrorPin] = useState<string | null>(null);
  const [exitoPin, setExitoPin] = useState(false);

  async function guardarNuevoPin() {
    setErrorPin(null);
    setExitoPin(false);

    if (!/^\d{6}$/.test(pinNuevo)) {
      setErrorPin("El PIN nuevo debe tener exactamente 6 dígitos.");
      return;
    }
    if (pinNuevo !== pinConfirmar) {
      setErrorPin("El PIN nuevo y su confirmación no coinciden.");
      return;
    }

    setCambiandoPin(true);
    try {
      await cambiarPin({
        pinActual,
        pinNuevo,
        usuario: getUsuario() || "admin",
        dispositivo: getDispositivoId(),
      });
      setExitoPin(true);
      setPinActual("");
      setPinNuevo("");
      setPinConfirmar("");
    } catch (err) {
      setErrorPin(err instanceof Error ? err.message : "No se pudo cambiar el PIN.");
    } finally {
      setCambiandoPin(false);
    }
  }

  return (
    <main className="flex-1 flex flex-col gap-6 p-4 max-w-2xl mx-auto w-full">
      <div className="flex items-center gap-2">
        <BotonVolver mensaje="¿Salir de configuración?" />
        <h1 className="text-xl font-bold">Configuración</h1>
      </div>

      <section className="border rounded-lg p-4 bg-card flex flex-col gap-3">
        <div>
          <h2 className="font-semibold">Apariencia</h2>
          <p className="text-xs text-muted-foreground">
            Esto se guarda por dispositivo — cada tablet o PC puede tener su propio look, no se
            comparte entre ellos.
          </p>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Modo</label>
          <div className="flex flex-wrap gap-2">
            {MODOS.map((m) => (
              <Button
                key={m.id}
                variant={modo === m.id ? "default" : "outline"}
                size="sm"
                onClick={() => elegirModo(m.id)}
              >
                {m.nombre}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Paleta de color</label>
          <div className="flex flex-wrap gap-2">
            {PALETAS.map((p) => (
              <button
                key={p.id}
                onClick={() => elegirPaleta(p.id)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                  paleta === p.id && !fondo
                    ? "border-foreground"
                    : "border-border hover:border-foreground/40"
                }`}
              >
                <span
                  className="size-4 rounded-full border"
                  style={{ backgroundColor: p.color }}
                />
                {p.nombre}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Color de fondo personalizado</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={fondo || "#ffffff"}
              onChange={(e) => aplicarFondoPersonalizado(e.target.value)}
              className="h-9 w-14 rounded border cursor-pointer"
            />
            <Input
              value={fondo}
              onChange={(e) => aplicarFondoPersonalizado(e.target.value)}
              placeholder="Elegí un color o escribilo (ej. #f5f5f5)"
              className="flex-1"
            />
            {fondo && (
              <Button variant="outline" size="sm" onClick={quitarFondoPersonalizado}>
                Quitar
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Reemplaza el fondo de la paleta elegida por el color que quieras.
          </p>
        </div>
      </section>

      <section className="border rounded-lg p-4 bg-card flex flex-col gap-3">
        <div>
          <h2 className="font-semibold">Seguridad</h2>
          <p className="text-xs text-muted-foreground">
            El PIN de cancelación lo pide la app antes de cancelar un pedido o revertir un cobro.
            Se guarda cifrado, nadie puede verlo — solo se puede cambiar sabiendo el actual.
          </p>
        </div>

        <div className="flex flex-col gap-3 max-w-sm">
          <div>
            <label className="text-sm font-medium mb-1 block">PIN actual</label>
            <Input
              type="password"
              inputMode="numeric"
              value={pinActual}
              onChange={(e) => setPinActual(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">PIN nuevo (6 dígitos)</label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pinNuevo}
              onChange={(e) => setPinNuevo(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Confirmar PIN nuevo</label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pinConfirmar}
              onChange={(e) => setPinConfirmar(e.target.value)}
            />
          </div>

          {errorPin && <p className="text-sm text-red-600">{errorPin}</p>}
          {exitoPin && <p className="text-sm text-green-600">PIN actualizado correctamente.</p>}

          <Button
            onClick={guardarNuevoPin}
            disabled={cambiandoPin || !pinActual || !pinNuevo || !pinConfirmar}
            className="self-start"
          >
            Cambiar PIN
          </Button>
        </div>
      </section>

      <Link href="/" className="text-sm underline text-neutral-500">
        Volver al inicio
      </Link>
    </main>
  );
}
