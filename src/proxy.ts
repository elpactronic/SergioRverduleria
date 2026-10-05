import { clerkMiddleware, clerkClient, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { usuariosPermitidos } from "@/db/schema";
import { eq } from "drizzle-orm";
import { rutaPermitida, pantallaInicial, type Rol } from "@/lib/roles";

const esRutaPublica = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

async function denegar(req: Request, sessionId: string | null) {
  // No es una persona autorizada: se revoca la sesión, no solo se redirige,
  // para que no quede logueada esperando otra oportunidad.
  if (sessionId) {
    const client = await clerkClient();
    await client.sessions.revokeSession(sessionId).catch(() => {});
  }
  return NextResponse.redirect(new URL("/sign-in", req.url));
}

export default clerkMiddleware(async (auth, req) => {
  if (esRutaPublica(req)) return;

  await auth.protect();
  const { sessionId, sessionClaims } = await auth();

  // El email viaja en el propio token de sesión (claim configurado en Clerk),
  // en vez de pedirlo a la API de Clerk en cada request.
  const email = (sessionClaims as { email?: string } | null)?.email?.toLowerCase();
  if (!email) {
    return denegar(req, sessionId);
  }

  // Falla CERRADO: si la persona no está en la tabla de usuarios permitidos
  // (o la base no responde), se bloquea en vez de dejar pasar. Es preferible
  // que la app quede inaccesible por un rato a que quede abierta.
  let fila;
  try {
    const db = getDb();
    fila = await db.query.usuariosPermitidos.findFirst({
      where: eq(usuariosPermitidos.email, email),
    });
  } catch {
    return denegar(req, sessionId);
  }

  if (!fila) {
    return denegar(req, sessionId);
  }

  const rol = fila.rol as Rol;
  const pathname = req.nextUrl.pathname;

  // Solo el administrador ve la pantalla de inicio — a los demás roles los
  // mandamos directo a su pantalla principal.
  if (pathname === "/" && rol !== "admin") {
    return NextResponse.redirect(new URL(pantallaInicial(rol), req.url));
  }

  if (!rutaPermitida(rol, pathname)) {
    return NextResponse.redirect(new URL(pantallaInicial(rol), req.url));
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
