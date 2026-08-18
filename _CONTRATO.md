# Contrato · Kit 02 · CRM Multicanal con IA

## Promesa

**Entra** una cuenta de proveedor de mensajería con WhatsApp, Instagram y/o Messenger
conectados, más una descripción del negocio → **sale** un CRM multicanal desplegado en
Vercel, con bandeja única, agente de IA por canal, contactos, pipeline, tareas e
integraciones hacia el sistema propio del cliente.

## Entrada, salida y usuario

| Campo | Valor |
|---|---|
| Entrada | Cuenta de proveedor (Zernio por defecto), proyecto de Supabase, descripción del negocio, y opcionalmente la API del sistema existente del cliente |
| Salida | Aplicación Next.js desplegada + `entrega/informe-de-entrega.md` con lo verificado |
| Usuario | Agencia o desarrollador que implementa una instancia por cliente |
| Mercado e idioma | Argentina, es-AR con voseo, en el kit y en la app |
| Agentes objetivo | Universal (`AGENTS.md`), con puentes para Claude Code, Codex y OpenCode |

## Modelo de negocio de la instalación

Un deploy por negocio. Cada cliente tiene su propio proyecto de Vercel y su propia base
de Supabase. Varios usuarios del mismo negocio entran con Supabase Auth. No es
multi-tenant: no hay `org_id` ni aislamiento por fila entre clientes distintos.

## Alcance

Incluye:

1. Bandeja única de WhatsApp, Instagram y Messenger, con respuesta manual.
2. Agente de IA por canal, configurable, con doble interruptor y guardrails completos.
3. Contactos con identidades cruzadas entre canales.
4. Pipeline de ventas en kanban.
5. Tareas, recordatorios y reportes.
6. Integraciones: webhooks salientes, API REST propia con claves, servidor MCP,
   adaptador tipado hacia el sistema propio del cliente, y conectores de calendario,
   planilla y catálogo.

Fuera de alcance:

- Multi-tenant, facturación a clientes finales y panel de administración de cuentas.
- Envío masivo, campañas y difusión. El kit es de atención y venta conversacional.
- Llamadas de voz, comentarios de publicaciones y reseñas, aunque el proveedor los ofrezca.
- Migración de datos desde otro CRM.

## Capacidades necesarias y alternativas

| Capacidad | Alternativa si no existe |
|---|---|
| Ejecutar comandos (`npm`, `node`) | Sin esto el kit no se puede construir. Frenar y avisar. |
| Leer una web y bajar un archivo | Sin esto no se puede tipar contra el OpenAPI: frenar la Fase 2. |
| Escribir archivos en la carpeta del proyecto | Obligatorio. |
| Acceso a la API del proveedor con clave real | Se puede construir hasta la Fase 3 con el ejemplo ficticio; la verificación real queda pendiente y se declara. |
| Base Postgres accesible | Se puede usar Supabase local o una base de prueba; sin base no se valida la Fase 1. |

## Permisos mínimos

- Clave de proveedor **restringida** (`zrk_`) con los grupos `messages`, `accounts` y
  `webhooks`. Nunca una clave completa.
- `SUPABASE_SERVICE_ROLE_KEY` solo del lado del servidor, nunca en el cliente.
- Nada de secretos por chat: van a `.env.local` y al panel de Vercel.

## Criterio de calidad

Un CRM entregado está terminado cuando, y solo cuando:

1. `npm run typecheck`, el linter y `npm run build` pasan limpios.
2. `npm run verificar:proveedor` lista cuentas y conversaciones contra la API real.
3. Reenviar el mismo evento de webhook dos veces no duplica ninguna fila.
4. Dos canales con prompts distintos responden distinto y no mezclan historial.
5. Un mensaje fuera de la ventana de 24 horas no se puede enviar desde la interfaz.
6. El guardrail bloquea un precio no autorizado y queda registrado.
7. La importación de historial no dispara al agente.
8. `python3 scripts/validar_kit.py` pasa sin errores.

## Estado de los pasos

| Paso | Estado |
|---|---|
| 0 · Retomar o empezar | ✅ |
| 1 · Entrevista | ✅ decidido con el usuario |
| 2 · Contrato | ✅ este archivo |
| 3 · Comprobar antes de prometer | ✅ ver `referencias/zernio-verificado.md` |
| 4 · Criterio de calidad | ✅ arriba |
| 5 · Construir el kit universal | ✅ |
| 6 · Ejemplo ficticio | ✅ 15 eventos, offline |
| 7 · Ejecutar el kit | ✅ typecheck, build y los 15 eventos del ejemplo, de punta a punta, contra Supabase y OpenRouter reales |
| 8 · Revisión | 🔄 `validar_kit.py` pasa |
| 9 · Empaquetado | ⬜ pendiente de tu visto bueno |

## Verificaciones ejecutadas

| Fecha | Qué se probó | Resultado |
|---|---|---|
| 17/08/2026 | Bajar el OpenAPI de Zernio sin credenciales | ✓ OpenAPI 3.1.0, v1.0.4, 397 rutas, 2,2 MB |
| 17/08/2026 | Que existan las rutas y campos que usa el cliente | ✓ inbox, accounts, webhooks, analytics |
| 17/08/2026 | Header y algoritmo de firma | ✓ `X-Zernio-Signature`, HMAC-SHA256, firma opcional → el kit va fail-closed |
| 18/08/2026 | `npm install` del núcleo | ✓ sin conflictos de versiones |
| 18/08/2026 | `tsc --noEmit` estricto sobre 36 archivos | ✓ 0 errores |
| 18/08/2026 | `npm run build` de producción | ✓ limpio; ambas rutas de API dinámicas |
| 18/08/2026 | `scripts/validar_kit.py` del creador | ✓ kit válido |
| 18/08/2026 | `npm run verificar:openapi` contra el spec en vivo | ✓ 18/18 nombres siguen existiendo; spec sigue en 1.0.4 |
| 18/08/2026 | `npm run db:generate` con base de prueba | ✓ 19 tablas; el índice parcial de idempotencia se emite correcto |
| 18/08/2026 | Migración aplicada a Supabase real (Postgres 17, sa-east-1) | ✓ 19 tablas, 19 con RLS |
| 18/08/2026 | Prueba de idempotencia en la base real | ✓ mismo `external_id` dos veces → 1 fila; dos salientes sin id → 2 filas |
| 18/08/2026 | `get_advisors` de Supabase, seguridad | ✓ sin errores ni advertencias; 18 avisos informativos de RLS sin política, que es el diseño |
| 18/08/2026 | `npm audit` | ⚠ `drizzle-orm` < 0.45.2 tenía inyección SQL (GHSA-gpj5-g38j-94v9) → **actualizado a 0.45.2** |
| 18/08/2026 | Los 15 eventos del ejemplo ficticio contra `next dev` + Supabase real + OpenRouter real | ⚠→✓ tres vueltas: ver "Bugs encontrados y corregidos" abajo |
| 18/08/2026 | Prueba de idempotencia end-to-end (evento repetido con el mismo id) | ✓ segunda entrega devuelve `reintento:true`, conteo de `messages` no sube |
| 18/08/2026 | Resistencia a inyección de prompt en mensaje real | ✓ el agente no reveló instrucciones ni confirmó un descuento inventado |
| 18/08/2026 | Aislamiento de datos entre clientes (Marina no puede ver la reparación de Bruno) | ✓ el adaptador devuelve null por `clienteId`, el agente lo reporta sin filtrar el dato ajeno |
| 18/08/2026 | Doble interruptor y canales apagados (Instagram/Messenger) | ✓ los mensajes entran a la bandeja, el agente no responde |

### Bugs encontrados y corregidos probando contra servicios reales

Ninguno de estos tres dio un error en ningún log. Se encontraron mirando el contenido
real de las conversaciones, no la salida del webhook — que es exactamente lo que
`referencias/trampas.md` pide hacer antes de declarar una fase terminada.

1. **El pool de conexiones colgaba `next dev` 5 minutos por evento.** `max: 1` es
   correcto en Vercel (una conexión por invocación) pero un cuello de botella real en
   un servidor de desarrollo persistente. Ahora `max` depende de `NODE_ENV`
   (`src/lib/db.ts`).
2. **La cascada de `agent_configs` nunca llegaba al valor global.** Las columnas que
   cascadean tenían `.notNull().default([])` / `.default(8)`: una fila de canal sin
   ese campo quedaba en `[]`/`8`, no en `null`, y el `??` de la cascada nunca caía al
   global. El agente se quedó sin herramientas —contestaba de memoria en vez de
   consultar el sistema— y el guardrail de precios quedó con la lista blanca vacía,
   es decir, permisivo. Corregido en el esquema (columnas nullable, sin default) y
   documentado como trampa 16.
3. **El guardrail de precios bloqueaba respuestas correctas** por leer el número de
   pedido (`PED-4471`), el año de una fecha (`11/08/2026`) o una cantidad con unidad
   (`40L`) como si fueran cifras de dinero sueltas. Corregido con extracción de la
   cifra completa + validación de contexto en JS, documentado como trampa 17.

Verificación final después de las tres correcciones: 4 conversaciones reales
completadas de punta a punta, con los datos exactos del fixture ficticio, sin un
bloqueo de guardrail de más ni de menos.

### Versiones resueltas y verificadas (18/08/2026)

`next 16.3.1` · `react 19.2.8` · `drizzle-orm 0.45.2` · `drizzle-kit 0.31.10` · `postgres 3.4.9` ·
`@supabase/supabase-js 2.112.3` · `openai 6.49.0` · `@modelcontextprotocol/sdk 1.30.0` ·
`zod 3.25.76`. Quedan fijadas en `base/package-lock.json`.

### Lo que NO se verificó, y por qué

- **Envío real de mensajes**: necesita una cuenta del proveedor con canales conectados.
  Lo verifica la Fase 2 con `npm run verificar:proveedor`.
- **Ventana de 24 horas por canal**: el spec expone `category: "utility"` para WhatsApp
  fuera de ventana, pero no probamos ese camino contra la API.
- **OAuth de conexión de cuentas**: depende del panel del proveedor.
- **El ejemplo ficticio de punta a punta**: necesita una base Postgres. La lógica
  compila y el simulador está escrito; la corrida queda para la instalación.

Nada de esto se declara como hecho en la documentación del kit.

## Seguridad de dependencias

`npm audit` deja 4 avisos moderados en `esbuild` y `@esbuild-kit/*`, que entran por
`drizzle-kit`. Son **solo de desarrollo**: `npm ls esbuild --omit=dev` devuelve vacío, así
que nada de eso llega al servidor desplegado. El aviso de esbuild afecta a su servidor de
desarrollo, que este kit no usa.

Revisá el audit en cada instalación: la foto de hoy no vale dentro de seis meses.

## Nota sobre la base de prueba

El esquema se aplicó al proyecto de Supabase con el MCP, no con `npm run db:migrate`.
Consecuencia concreta: drizzle **no sabe** que esa migración ya corrió, así que en esa
base `db:migrate` va a fallar con "la tabla ya existe".

Para una instalación nueva, el camino normal del kit sigue siendo `npm run db:migrate`
sobre una base vacía. Sobre esta base de prueba, los cambios de esquema se aplican con
`db:generate` y después el SQL a mano.
