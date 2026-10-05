export type Rol = "admin" | "vendedor" | "cajero";

/**
 * Qué rutas puede ver cada rol. `null` significa "todas". Cajero incluye
 * Vendedor a propósito: así puede cargar un pedido nuevo si el cliente se
 * acuerda de algo después de pagar, sin que el Vendedor pueda a su vez
 * entrar a Caja y cobrar.
 */
export const RUTAS_PERMITIDAS: Record<Rol, string[] | null> = {
  admin: null,
  cajero: ["/caja", "/vendedor", "/cierre-caja"],
  vendedor: ["/vendedor"],
};

export function rutaPermitida(rol: Rol, pathname: string): boolean {
  const permitidas = RUTAS_PERMITIDAS[rol];
  if (permitidas === null) return true;
  return permitidas.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/** A dónde mandar a cada rol cuando entra o cuando pide una pantalla que no le corresponde. */
export function pantallaInicial(rol: Rol): string {
  if (rol === "cajero") return "/caja";
  if (rol === "vendedor") return "/vendedor";
  return "/";
}

export const ROL_LABEL: Record<Rol, string> = {
  admin: "Administrador",
  vendedor: "Vendedor",
  cajero: "Cajero",
};
