import { clerkMiddleware, clerkClient, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const esRutaPublica = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

// Lista blanca de emails que pueden usar la app, sin importar cuántas cuentas
// existan en Clerk. Esto es lo que de verdad bloquea el acceso — no depende
// de que el modo de registro de Clerk esté bien configurado en el dashboard.
const EMAILS_PERMITIDOS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export default clerkMiddleware(async (auth, req) => {
  if (esRutaPublica(req)) return;

  await auth.protect();
  const { sessionId, sessionClaims } = await auth();

  // El email viaja en el propio token de sesión (claim configurado en Clerk),
  // en vez de pedirlo a la API de Clerk en cada request — eso agregaba un
  // viaje de red extra a cada página del sitio.
  const email = (sessionClaims as { email?: string } | null)?.email?.toLowerCase();

  // Falla CERRADO: si por lo que sea no hay lista de emails configurada, se
  // bloquea todo en vez de dejar pasar a cualquier cuenta autenticada. Es
  // preferible que la app quede inaccesible por un rato a que quede abierta.
  if (EMAILS_PERMITIDOS.length === 0 || !email || !EMAILS_PERMITIDOS.includes(email)) {
    // No es el admin autorizado (o falta la configuración): se revoca la
    // sesión, no solo se redirige, para que no quede logueado esperando
    // otra oportunidad.
    if (sessionId) {
      const client = await clerkClient();
      await client.sessions.revokeSession(sessionId).catch(() => {});
    }
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
