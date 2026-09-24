## /qa — 2026-09-24

### TL;DR
- 🔴 Un pedido o cobro que falla al sincronizar queda en `syncStatus="error"` **para siempre, sin reintento y sin aviso visible** — `flushPedidosPendientes`/`flushCobrosPendientes` (`src/lib/offline/sync.ts`) solo re-consultan los que están en `"pendiente"`. La pantalla del vendedor nunca lee ni muestra su propia cola `pedidosPendientes`.
- 🔴 Doble clic en "Confirmar pedido e imprimir" (`src/app/vendedor/page.tsx:336`) o en "Registrar cobro" (`src/app/caja/page.tsx:258`) — ninguno tiene guard de "procesando". El primero puede duplicar `numeroPedido` (race en `siguienteNumeroPedido()`, get+put sin transacción); el segundo puede duplicar la conciliación y **descontar stock dos veces**, porque `conciliarCobro()` no chequea si el pedido ya estaba `cobrado` antes de insertar el movimiento.
- 🟡 "Dar de baja" en Productos/Clientes no pide confirmación (inconsistente con el resto de la app); `agregarItem()` en vendedor acepta cantidad/precio `"0"` o negativo sin avisar.

### Flags para otros agentes
- Para **/cto**: los hallazgos 1 y 2 son de arquitectura (falta de idempotencia y de mecanismo de reintento), no de UI — probablemente les interese revisar el patrón completo antes de aprobar el diseño offline-first para producción real.
- Para **/pm**: recomiendo priorizar el fix de "doble clic" (guard de procesando + idempotencia en conciliarCobro) por encima de cualquier feature nueva — es rápido y cierra el riesgo más serio del sistema.
- Para **/seguridad**: la falta de idempotencia en `conciliarCobro` es explotable igual de fácil por un doble clic accidental que por un ataque deliberado (relacionado con la falta de rate-limit que ya documentaste, pero es un problema distinto: acá no hace falta ninguna intención maliciosa).
- Para **/listo**: no recomendaría autorizar uso diario sin supervisión hasta resolver al menos el punto 1 (sync silenciosamente perdido) — es una pérdida de venta invisible para el dueño del negocio.

### Veredicto
❌ NO APTO PARA PRODUCCIÓN sin supervisión — la arquitectura es sólida, pero el mecanismo de reintento de sync (el corazón de la propuesta offline-first) tiene un agujero real: una falla transitoria se convierte en una venta perdida sin que nadie se entere.

---

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

### Actualización — mismo día, post-corrección
Los 2 críticos y 2 de los 3 ALTO/MEDIO ya se resolvieron (commit `f06c8bd`): `ADMIN_EMAILS`/`PIN_CANCELACION` cargados en Vercel (los 3 ambientes), `src/proxy.ts` ahora falla cerrado, `cancelarPedido()` tiene límite de 5 intentos/15min sin default hardcodeado, cabeceras de seguridad agregadas en `next.config.ts`, y `audit_log` ahora guarda el `clerk_user_id` real además del campo "usuario" auto-reportado. Validado con build/lint limpios, curl (cabeceras) y un script contra la base real (rate limit).

**Pendiente, no bloqueante**: validación de rango en montos/cantidades con Zod (MEDIO), migrar Clerk a instancia de producción antes del lanzamiento real (MEDIO), opción en `/configuracion` para cambiar el PIN sin pasar por Vercel (mejora de usabilidad pedida por el usuario). El PIN actual en producción ("123456") es explícitamente temporal — el usuario dijo que lo va a cambiar una vez que exista esa opción en la UI.

**Para /listo**: los bloqueantes de seguridad ya no aplican. Los pendientes de arriba no impiden un lanzamiento a modo prueba, sí conviene resolverlos antes de depender de esto en serio todos los días.

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
