# Fase 1 · Modelo de datos

El esquema ya está escrito en `base/db/esquema.ts`. Tu trabajo acá no es diseñarlo:
es copiarlo, entenderlo, correr la migración y adaptar solo lo que la entrevista pida.

## Qué hacer

1. Copiá `base/` completo a `workspace/<cliente>/` y renombrá lo que haga falta.
2. `npm install`.
3. Completá `DATABASE_URL` en `.env.local` con la cadena del **pooler** de Supabase
   (puerto 6543, "Transaction pooler"). La conexión directa agota la base en serverless.
4. La migración inicial ya viene generada y revisada en `db/migraciones/`. Leela antes
   de aplicarla: son 240 líneas y explican el esquema mejor que cualquier resumen.
   Si adaptaste algo del esquema, corré `npm run db:generate` y revisá el SQL nuevo.
5. `npm run db:migrate`.
6. Cargá los datos iniciales: las etapas del pipeline que dijo el negocio y las filas de
   `agent_configs` (el canal principal en `enabled=true`, los otros dos en `false`).

## Las decisiones que no se tocan

Cada una de estas evita una pérdida silenciosa. Están explicadas en el propio archivo
del esquema; si alguien las "simplifica", el CRM sigue compilando y empieza a perder
mensajes.

| Decisión | Qué pasa si se cambia |
|---|---|
| `channel` y `provider` en columnas separadas | Migrar de proveedor obliga a reescribir la mitad de las consultas |
| Único en `conversations(provider, external_id)` | El mismo hilo se duplica en cada reintento |
| Índice único **parcial** en `messages(external_id) where not null` | Los mensajes salientes chocan entre sí antes de tener id |
| Índice sobre `external_id` **solo**, no compuesto | En una migración de proveedor el mismo mensaje entra dos veces |
| `contact_identities(channel, external_id)` único | La misma persona por dos redes queda como dos contactos |
| `last_inbound_at` en la conversación | Sin esto la ventana de 24 horas la termina decidiendo la interfaz |
| `webhook_events.event_id` como clave primaria | Se pierde la idempotencia y el agente contesta dos veces |
| `unread_count` como columna | Un `COUNT` por fila hace que la bandeja se arrastre con 500 hilos |

## Lo que sí se adapta al negocio

- Las **etapas del pipeline**: las que dijo en la entrevista, en su orden y con sus
  nombres. Si no las tenía claras: Nuevo → Contactado → Presupuestado → Ganado / Perdido.
- Los **campos de la ficha** del contacto viven en `contacts.fields` (jsonb). No agregues
  columnas por cada dato que pide el negocio: la herramienta de calificar escribe ahí.
- Las **etiquetas** iniciales, si el negocio ya trabaja con alguna clasificación.

## Seguridad de la base

Corré también `db/politicas.sql`. Habilita RLS con denegación total en todas las tablas.

El CRM entra con la clave de servicio del lado del servidor, así que no necesita
políticas permisivas. Lo que evita es que la clave anónima —que sí viaja al navegador—
pueda leer la base si alguien apunta el cliente de Supabase a una tabla.

## Verificación de la fase

No sigas sin esto:

```bash
npm run db:migrate
npm run typecheck
npm run build
```

Y mostrale al usuario el conteo de filas por tabla:

```sql
select 'conversations' as tabla, count(*) from conversations
union all select 'messages', count(*) from messages
union all select 'contacts', count(*) from contacts
union all select 'agent_configs', count(*) from agent_configs
union all select 'pipeline_stages', count(*) from pipeline_stages;
```

`agent_configs` tiene que tener una fila por canal más la global, y **solo el canal
principal en `enabled=true`**.
