export type Rol = "vendedor" | "cajero";

const ROL_KEY = "verduleria:rol";
const USUARIO_KEY = "verduleria:usuario";
const DISPOSITIVO_KEY = "verduleria:dispositivo";

export function getRol(): Rol | null {
  if (typeof window === "undefined") return null;
  return (localStorage.getItem(ROL_KEY) as Rol) || null;
}

export function setSesion(rol: Rol, usuario: string) {
  localStorage.setItem(ROL_KEY, rol);
  localStorage.setItem(USUARIO_KEY, usuario);
}

export function getUsuario(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(USUARIO_KEY) || "";
}

export function getDispositivoId(): string {
  if (typeof window === "undefined") return "server";
  let id = localStorage.getItem(DISPOSITIVO_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DISPOSITIVO_KEY, id);
  }
  return id;
}

export function cerrarSesion() {
  localStorage.removeItem(ROL_KEY);
  localStorage.removeItem(USUARIO_KEY);
}
