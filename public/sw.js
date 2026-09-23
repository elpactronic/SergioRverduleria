const CACHE_NAME = "verduleria-shell-v2";
// Solo rutas públicas: las protegidas por login se cachean solas al visitarlas
// autenticado (ver el handler de "fetch" más abajo), no acá. Precachear "/" o
// "/vendedor" en la instalación (antes de iniciar sesión) guardaría la
// redirección al login en vez de la página real.
const SHELL_URLS = ["/sign-in", "/manifest.json", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

// Solo cachea GET. Server actions y APIs (POST) siempre van directo a la red:
// si fallan offline, la app ya sabe guardarlas en IndexedDB y reintentar.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copia = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia));
        return response;
      })
      .catch(async () => {
        const cacheado = await caches.match(event.request);
        if (cacheado) return cacheado;
        if (event.request.mode === "navigate") {
          const shell = await caches.match("/");
          if (shell) return shell;
        }
        return Response.error();
      }),
  );
});
