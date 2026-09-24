## Aclaración del usuario — 2026-09-23
El usuario confirmó explícitamente: "online desde la nube + tal vez servidor local más adelante" es solo arquitectura (Vercel ahora, posible servidor local en el negocio como Fase 2 de resiliencia offline — ver conversación anterior). **No hay intención de vender esto a otros negocios.** La clasificación B) PROYECTO PEQUEÑO y la lista de agentes innecesarios (`/director`, `/mono`, `/startup`, `/legal`) del análisis de `/equipo` quedan confirmadas sin cambios.

## /seguridad — 2026-09-23

### TL;DR
- 🔴 `ADMIN_EMAILS` y `PIN_CANCELACION` nunca se subieron a Vercel (confirmado con `vercel env ls`) — si se despliega hoy, la allowlist de emails y el PIN de cancelación quedan desactivados/en su default público "1234".
- 🔴 El PIN de cancelación (`cancelarPedido` en `src/lib/actions/pedidos.ts`) no tiene límite de intentos — 4 dígitos = fuerza bruta trivial una vez que hay sesión válida.
- 🟠 El campo "usuario" (V1/C1) de `audit_log` es un string auto-reportado por el cliente (localStorage), nunca verificado contra el userId real de Clerk — debilita el valor probatorio del historial pensado para cruzar con cámaras.

### Flags para otros agentes
- Para **/cto**: revisar si conviene invertir la lógica de `src/proxy.ts` para que falle CERRADO (bloquear todo si `ADMIN_EMAILS` no está seteada) en vez de fail-open como está ahora.
- Para **/qa**: agregar un caso de prueba explícito de "cancelar pedido con PIN incorrecto repetidas veces" — hoy no hay ningún límite que valga la pena probar, pero debería haberlo después de la corrección.
- Para **/pm**: cargar las env vars faltantes en Vercel es un bloqueante de 5 minutos, no una tarea de roadmap — priorizarlo antes de cualquier otra cosa de la Fase 1.
- Para **/listo**: no autorizar deploy a producción hasta que `ADMIN_EMAILS` y `PIN_CANCELACION` estén confirmados en Vercel (no solo en `.env.local`).

### Veredicto
❌ NO APROBADO — dos críticos activos ahora mismo (no hipotéticos, confirmados con `vercel env ls`), pero ambos son de configuración y se resuelven en minutos, no de rediseño.

---

## /equipo — 2026-09-23

### Proyecto
Sistema interno de gestión para "Verdulería Rogel": pedidos offline-first (PWA), caja con conciliación de cobros, control de stock de depósito persistente, cancelaciones/devoluciones con PIN, historial de auditoría, login único (Clerk) recién agregado porque la app pasó a estar accesible desde la nube. Clasificación: **B) PROYECTO PEQUEÑO** — herramienta a medida para un solo negocio, sin ambición comercial ni de escala.

### Equipo recomendado
- **Obligatorios**: `/seguridad`, `/qa`, `/listo`
- **Opcionales**: `/cto` (auditoría técnica general), `/pm` (consolidar qué es "Fase 1 cerrada"), `/design` (pulido visual)
- **Innecesarios**: `/director`, `/mono`, `/ia`, `/legal`, `/startup` — no aplican a un sistema interno sin objetivo comercial ni de escala
- **Ya ejecutado implícitamente**: `/stack` (Next.js + Postgres/Neon + Drizzle + Clerk + PWA offline + Vercel, ya construido y funcionando durante toda la conversación previa)

### Orden de ejecución
```
FASE 1 (opcional) → /pm
FASE 2 (en paralelo) → /seguridad + /cto + /qa
FASE 3 (opcional, paralelo a Fase 2) → /design
FASE 4 (final) → /listo
```

### TL;DR
- **Tipo de usuario**: 2 roles internos (vendedor, cajero) de una sola verdulería real — no hay clientes externos ni multi-tenant.
- **Restricción principal**: ya hubo un incidente de seguridad real (una cuenta ajena se creó y entró vía sign-up sin restringir; se resolvió con una lista blanca de emails en `src/proxy.ts`, pero falta una revisión sistemática — PIN de cancelación hardcodeado a `1234`, claves de Clerk en modo desarrollo).
- **Objetivo**: llevar el sistema a uso diario real y confiable para el negocio (maneja pedidos, cobros y stock reales) — todavía no hubo un veredicto formal de lanzamiento.

### Primer paso
Ejecutar `/seguridad` — es el único punto con un incidente real ya confirmado en esta sesión (no hipotético), y lo más urgente antes de que el negocio dependa de esto todos los días.
