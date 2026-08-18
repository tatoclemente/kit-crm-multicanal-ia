# Kit 02 · CRM Multicanal con IA

> Una bandeja única donde entran y se responden WhatsApp, Instagram y Messenger, con un
> agente de IA configurable por canal que contesta solo.

Kit universal: funciona con Codex, Claude Code, OpenCode, Antigravity o cualquier agente
que lea `AGENTS.md` y Agent Skills. No depende de una marca de modelo.

---

## Qué construye

Un CRM completo, desplegado en Vercel con Supabase de base y login:

- **Bandeja única** de los tres canales, con respuesta manual y ventana de 24 horas
  calculada en el servidor.
- **Agente de IA por canal**, con su prompt, sus herramientas y su interruptor. Los
  canales nuevos arrancan apagados.
- **Contactos con identidades cruzadas**: la misma persona por Instagram y por WhatsApp
  es un solo contacto con dos conversaciones.
- **Pipeline** de ventas en kanban, con historial de etapas.
- **Tareas, recordatorios y reportes**.
- **Integraciones**: webhooks salientes firmados, API REST propia con claves y permisos,
  servidor MCP, y un adaptador tipado hacia el sistema que el cliente ya usa.
- **Guardrails completos**: lista blanca de precios y de dominios, canario anti-fuga del
  prompt, y registro auditable de todo lo que se bloqueó.

Una instalación por negocio: su propio proyecto de Vercel y su propia base.

## Cómo está armado

El kit es **híbrido**: trae escrito el núcleo que no se puede adivinar, y construye el
resto por fases.

```
02-crm-multicanal-ia/
├── AGENTS.md                  ← instrucciones canónicas
├── CLAUDE.md                  ← puente para Claude Code
├── EMPEZA-ACA.md
├── .agents/skills/crm-multicanal/
│   ├── SKILL.md               ← el método, en diez fases
│   └── referencias/           ← una por fase, más trampas y diagnóstico
├── base/                      ← el núcleo, ya escrito y tipado
│   ├── db/esquema.ts          ← modelo de datos
│   ├── src/lib/canales/       ← proveedor intercambiable (Zernio implementado)
│   ├── src/lib/mensajeria/    ← camino único de salida y ventana de 24 h
│   ├── src/lib/agente/        ← runner, guardrails, herramientas
│   ├── src/lib/integraciones/ ← sistema externo, webhooks salientes
│   ├── mcp/servidor.ts        ← el CRM como herramientas MCP
│   └── scripts/               ← verificación contra la API real
├── ejemplos/                  ← caso ficticio ejecutable, 15 eventos con trampas
└── workspace/                 ← acá se construye el CRM de cada cliente
```

**Qué trae hecho**: modelo de datos, cliente del proveedor tipado contra el OpenAPI real,
webhook con firma e idempotencia, camino único de salida, ventana de 24 horas, runner del
agente con doble interruptor, guardrails, herramientas, contrato de integraciones,
servidor MCP y los scripts de verificación.

**Qué construye el agente**: la interfaz (bandeja, ficha de contacto, kanban, tareas,
reportes, ajustes), el adaptador del sistema real del cliente, la API pública y el deploy.

Esa división no es caprichosa: lo que está escrito es donde un error no da error y se
pierden mensajes en silencio. La interfaz, en cambio, se ve enseguida cuando está mal.

## Qué verificamos, y qué no

Verificado el 17/08/2026:

- El OpenAPI de Zernio se baja sin credenciales y es real: OpenAPI 3.1, versión 1.0.4,
  397 rutas. Los nombres de campo del cliente salen de ahí, no de una suposición.
- `X-Zernio-Signature`, HMAC-SHA256, firma **opcional** del lado del proveedor: por eso
  el kit rechaza todo si no hay secreto configurado.
- El núcleo (36 archivos) pasa `tsc --noEmit` en modo estricto, sin errores.

Todavía **no** verificado contra la API en vivo, porque depende de las credenciales de
cada instalación: el envío real de mensajes, la ventana de 24 horas por canal y el OAuth
de conexión de cuentas. Eso lo verifica la Fase 2 y la Fase 8 con la cuenta del cliente,
y queda anotado en el informe de entrega.

## Costos aproximados

| Servicio | Costo |
|---|---|
| Zernio | Las 2 primeras cuentas conectadas, gratis |
| Vercel | Gratis para empezar |
| Supabase | Gratis para empezar |
| OpenRouter | Por uso; con saldo chico alcanza para probar |

Cambian seguido: confirmalos antes de pasarle un presupuesto a un cliente.

## Lo que este kit no hace

- No es multi-tenant: es un deploy por negocio.
- No hace envíos masivos, difusión ni campañas. Es atención y venta conversacional.
- No migra datos desde otro CRM.
- No reemplaza a una persona en reclamos, excepciones ni negociación: para eso está la
  derivación.
