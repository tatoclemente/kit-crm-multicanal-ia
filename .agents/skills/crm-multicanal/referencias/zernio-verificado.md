# Zernio · lo que verificamos contra el spec real

**Verificado el 17 de agosto de 2026** contra `https://docs.zernio.com/api/openapi`
(OpenAPI 3.1.0, `Zernio API` versión **1.0.4**, 397 rutas, 2,2 MB de YAML).

Esta ficha es una foto con fecha, no la verdad permanente. Antes de tocar el cliente
HTTP corré `npm run verificar:openapi`: baja el spec de hoy y compara estos nombres
contra los de ahora. Si algo cambió, arreglá los tipos primero.

## Servidor y autenticación

| Dato | Valor |
|---|---|
| Base URL | `https://zernio.com/api` |
| Autenticación | `Authorization: Bearer <API key>` (esquema `bearerAuth`) |
| Formato de clave | prefijo `sk_` + 64 hex |
| Clave restringida | prefijo `zrk_`, limitada por grupo de recursos |

**Usá siempre una clave `zrk_`** con los grupos `messages`, `accounts` y `webhooks`.
Una clave restringida no puede suscribirse a eventos fuera de sus grupos, así que
tampoco puede crear una suscripción más amplia que ella misma. Es el mínimo privilegio
que el proveedor ya te da gratis.

## Canales

El spec usa `platform`, no `channel`. Los valores que nos importan:

| Nuestro `channel` | `platform` de Zernio | Nota |
|---|---|---|
| `whatsapp` | `whatsapp` | |
| `instagram` | `instagram` | |
| `facebook` | `facebook` | Es Messenger. No existe el valor `messenger`. |

`GET /v1/inbox/conversations` acepta además `twitter`, `bluesky`, `reddit` y `telegram`.
`InboxWebhookMessage.platform` acepta `instagram`, `facebook`, `telegram`, `whatsapp`,
`sms`. **Las dos listas no son iguales**: no derives una de la otra.

## Endpoints que usa el CRM

| Operación | Ruta |
|---|---|
| Listar conversaciones | `GET /v1/inbox/conversations` |
| Abrir conversación nueva | `POST /v1/inbox/conversations` |
| Listar mensajes | `GET /v1/inbox/conversations/{conversationId}/messages` |
| Responder en un hilo | `POST /v1/inbox/conversations/{conversationId}/messages` |
| Marcar leído | `POST /v1/inbox/conversations/{conversationId}/read` |
| Indicador de "escribiendo" | `POST /v1/inbox/conversations/{conversationId}/typing` |
| Listar cuentas | `GET /v1/accounts` |
| Alta/baja de webhook | `GET POST PUT DELETE /v1/webhooks/settings` |
| Probar webhook | `POST /v1/webhooks/test` |
| Registro de entregas | `GET /v1/webhooks/logs` |
| Métricas de bandeja | `GET /v1/analytics/inbox/{volume,response-time,heatmap,source-breakdown,top-accounts}` |

Abrir un hilo nuevo y responder en uno existente son **endpoints distintos**. El primero
pide `accountId` y `participantId` o `participantUsername`; el segundo va contra el
`conversationId`.

## La trampa de los nombres: REST ≠ webhook

Misma información, nombres distintos. Esto es literal, no un ejemplo.

| Concepto | REST devuelve | Webhook manda |
|---|---|---|
| Id del mensaje en la plataforma | *(no expuesto igual)* | `message.platformMessageId` |
| Texto del mensaje | `messages[].message` | `message.text` (puede ser `null`) |
| Quién lo mandó | `messages[].senderId`, `senderName` | `message.sender.id`, `message.sender.name` |
| Teléfono del contacto | *(no viene)* | `message.sender.phoneNumber` (puede ser `null`) |
| Id de conversación del proveedor | `data[].id` | `conversation.platformConversationId` |
| Nombre del participante | `data[].participantName` | `conversation.participantName` |
| Última actividad | `data[].updatedTime` | `message.sentAt` |
| Cuenta | `data[].accountId` | `account.accountId` (y `account.id`, mismo valor) |
| Dirección | `messages[].direction` (`incoming`/`outgoing`) | `message.direction` (igual) |

Si tipás el webhook con la forma del REST, el `text` te queda `undefined` en cada
mensaje, el `INSERT` guarda una fila vacía y no hay error en ningún lado.

Detalle que muerde: en Instagram y Facebook la `url` de un adjunto es un enlace firmado
de Meta que **vence**. Guardá `refreshUrl`, no `url`.

## Idempotencia

Cada entrega trae `id` en la raíz del payload: *"Stable webhook event ID"*. Ese es el
que va a `webhook_events`. No uses `message.id` ni `platformMessageId` para eso.

`timestamp` es cuándo Zernio **generó** el evento, no cuándo lo entregó. Un evento que
llega una hora tarde trae el timestamp viejo: por eso el agente descarta mensajes
vencidos comparando contra `timestamp`, no contra la hora de llegada.

## Firma

Header **`X-Zernio-Signature`**, HMAC-SHA256 sobre el body crudo.

El spec dice que la firma es **opcional**: si no configurás secreto, no viene firma y
cualquiera que descubra tu URL puede inyectar conversaciones. Por eso el kit va
*fail-closed*: sin `ZERNIO_WEBHOOK_SECRET` la ruta devuelve 401 y no procesa nada.

## Eventos que consume el CRM

`message.received`, `conversation.started`, `message.sent`, `message.delivered`,
`message.read`, `message.failed`, `referral.received`, `account.connected`,
`account.disconnected`, `webhook.test`.

El resto (`post.*`, `comment.*`, `review.*`, `call.*`, `lead.*`, `ad.*`) está fuera de
alcance: se registran y se responde 200. **Nunca 500 en un evento desconocido**: el
campo `failureCount` del webhook cuenta fallos consecutivos y el proveedor
**desactiva la suscripción a los 10**. Diez respuestas 500 seguidas y el CRM se queda
mudo sin que nadie se entere.

## Atribución de anuncios

`GET /v1/inbox/conversations` devuelve `metadata` con la atribución del click cuando la
conversación arrancó desde un anuncio de Meta o un enlace `ig.me`/`m.me` con `ref`.
El spec avisa de algo importante: **gana el primer referral**. Si la misma persona vuelve
por otro anuncio, `metadata` conserva el original. Para el referral fresco de cada click
hay que escuchar `message.received` o `referral.received`.

Guardá eso apenas entra. De qué campaña vino un lead es información que después no se
puede recuperar.

## Lo que todavía no verificamos

- El comportamiento real de la ventana de 24 horas por canal: el spec expone
  `category: "utility"` para envíos fuera de ventana en WhatsApp (Meta Direct Send, sin
  plantilla aprobada), pero no probamos ese camino contra la API.
- Los límites de tamaño y formato de adjuntos en cada canal.
- El tiempo real de propagación de `account.connected` después del OAuth.

Cuando los pruebes, anotá acá el resultado y la fecha. Una ficha que no se actualiza
miente peor que no tener ficha.
