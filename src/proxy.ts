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
  const { userId, sessionId } = await auth();

  if (EMAILS_PERMITIDOS.length > 0 && userId) {
    const client = await clerkClient();
    const usuario = await client.users.getUser(userId);
    const email = usuario.primaryEmailAddress?.emailAddress?.toLowerCase();

    if (!email || !EMAILS_PERMITIDOS.includes(email)) {
      // No es el admin autorizado: se revoca la sesión (no solo se redirige,
      // para que no quede logueado esperando otra oportunidad) y se manda al login.
      if (sessionId) {
        await client.sessions.revokeSession(sessionId).catch(() => {});
      }
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
