"use client";

let ctx: AudioContext | null = null;

function contexto(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return null;
  if (!ctx) ctx = new AudioCtor();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function tono(frecuencia: number, inicioMs: number, duracionMs: number, volumen = 0.15) {
  const audio = contexto();
  if (!audio) return;
  const oscilador = audio.createOscillator();
  const ganancia = audio.createGain();
  oscilador.frequency.value = frecuencia;
  oscilador.type = "sine";
  const inicio = audio.currentTime + inicioMs / 1000;
  const fin = inicio + duracionMs / 1000;
  ganancia.gain.setValueAtTime(0, inicio);
  ganancia.gain.linearRampToValueAtTime(volumen, inicio + 0.01);
  ganancia.gain.linearRampToValueAtTime(0, fin);
  oscilador.connect(ganancia);
  ganancia.connect(audio.destination);
  oscilador.start(inicio);
  oscilador.stop(fin + 0.02);
}

/** Sonido corto: llegó un pedido nuevo para cobrar. */
export function sonarPedidoNuevo() {
  tono(880, 0, 120);
}

/** Dos tonos ascendentes: se cobró un pedido. */
export function sonarCobrado() {
  tono(660, 0, 100);
  tono(880, 120, 140);
}

/** Dos tonos descendentes: se retiró un pedido. */
export function sonarRetirado() {
  tono(1046, 0, 100);
  tono(659, 120, 160);
}
