export type Modo = "claro" | "oscuro" | "sistema";
export type Paleta = "neutro" | "verde" | "naranja" | "azul";

const MODO_KEY = "verduleria:tema:modo";
const PALETA_KEY = "verduleria:tema:paleta";
const FONDO_KEY = "verduleria:tema:fondo";

export const PALETAS: { id: Paleta; nombre: string; color: string }[] = [
  { id: "neutro", nombre: "Neutro", color: "#171717" },
  { id: "verde", nombre: "Verde", color: "#059669" },
  { id: "naranja", nombre: "Naranja", color: "#ea580c" },
  { id: "azul", nombre: "Azul", color: "#2563eb" },
];

export function getModo(): Modo {
  if (typeof window === "undefined") return "sistema";
  return (localStorage.getItem(MODO_KEY) as Modo) || "sistema";
}

export function getPaleta(): Paleta {
  if (typeof window === "undefined") return "neutro";
  return (localStorage.getItem(PALETA_KEY) as Paleta) || "neutro";
}

export function getFondoPersonalizado(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(FONDO_KEY);
}

function prefiereOscuro(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
}

/** Aplica modo + paleta + fondo personalizado al <html>. Se llama al cargar y cada vez que cambian. */
export function aplicarTema(modo: Modo, paleta: Paleta, fondoPersonalizado: string | null) {
  const root = document.documentElement;

  const oscuro = modo === "oscuro" || (modo === "sistema" && prefiereOscuro());
  root.classList.toggle("dark", oscuro);

  for (const p of PALETAS) root.classList.remove(`paleta-${p.id}`);
  if (paleta !== "neutro") root.classList.add(`paleta-${paleta}`);

  if (fondoPersonalizado) {
    root.style.setProperty("--background", fondoPersonalizado);
  } else {
    root.style.removeProperty("--background");
  }
}

export function setModo(modo: Modo) {
  localStorage.setItem(MODO_KEY, modo);
  aplicarTema(modo, getPaleta(), getFondoPersonalizado());
}

export function setPaleta(paleta: Paleta) {
  localStorage.setItem(PALETA_KEY, paleta);
  // Cambiar de paleta descarta el fondo personalizado, para que no queden mezclados.
  localStorage.removeItem(FONDO_KEY);
  aplicarTema(getModo(), paleta, null);
}

export function setFondoPersonalizado(color: string | null) {
  if (color) localStorage.setItem(FONDO_KEY, color);
  else localStorage.removeItem(FONDO_KEY);
  aplicarTema(getModo(), getPaleta(), color);
}
