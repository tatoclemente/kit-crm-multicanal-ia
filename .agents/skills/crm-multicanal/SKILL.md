---
name: crm-multicanal
description: "Construye y entrega un CRM multicanal con IA: bandeja única de WhatsApp, Instagram y Messenger, agente configurable por canal, contactos con identidades cruzadas, pipeline, tareas, integraciones con el sistema propio del cliente y deploy en Vercel con Supabase. Usar cuando el usuario diga 'quiero un CRM', 'unificar WhatsApp e Instagram', 'bandeja única', 'un agente que atienda mis canales', 'conectá Instagram', 'integralo con mi sistema', 'publicá el CRM' o 'entregáselo al cliente'. También para retomar una construcción a medias o diagnosticar un CRM ya entregado."
---

# CRM Multicanal con IA

Construís el CRM dentro de `workspace/<cliente>/`. Diez fases en orden. Cada fase
termina con una verificación concreta: si no pasa, no se avanza.

El kit trae en `base/` el núcleo ya escrito y tipado contra el OpenAPI real del
proveedor: modelo de datos, cliente HTTP, webhook, camino único de salida, contratos del
agente y de las integraciones. Eso es lo que no se puede adivinar. Vos construís encima.

Cargá una referencia cuando llegues a la fase que la necesita, no antes:

| Fase | Referencia |
|---|---|
| 0 · Entrevista | `referencias/entrevista.md` |
| 1 · Datos | `referencias/fase-1-datos.md` |
| 2 · Proveedor | `referencias/fase-2-proveedor.md` + `referencias/zernio-verificado.md` |
| 3 · Webhook | `referencias/fase-3-webhook.md` |
| 4 · Bandeja | `referencias/fase-4-bandeja.md` |
| 5 · Agente | `referencias/fase-5-agente.md` + `referencias/guardrails.md` |
| 6 · CRM | `referencias/fase-6-crm.md` |
| 7 · Integraciones | `referencias/fase-7-integraciones.md` |
| 8 · Producción | `referencias/fase-8-produccion.md` |
| 9 · Entrega | `referencias/entrega-a-cliente.md` |
| Siempre a mano | `referencias/trampas.md`, `referencias/diagnostico.md` |

## Antes de la Fase 0 — Comprobar el entorno

Con acciones chicas y reversibles, comprobá y anotá el resultado:

1. `node -v` → 20 o superior. Sin esto, frená.
2. `npm -v` y acceso al registro (`npm ping`).
3. Que podés bajar un archivo de la web (`curl -sS -o /dev/null -w '%{http_code}' https://docs.zernio.com/api/openapi`).
4. Que podés escribir en `workspace/`.

Si falta algo, decí qué falta y qué se puede construir igual. No prometas una fase que
no vas a poder verificar.

## Fase 0 — Entrevista del negocio

Leé `referencias/entrevista.md`. Dos tandas cortas, no un interrogatorio.

Cerrá con la promesa concreta y pedí confirmación:

> El CRM de **[negocio]** atiende **[canales]**, el agente **[qué hace]** y deriva a un
> humano cuando **[condición]**. Los datos que captura van a **[destino]**.

Escribí `workspace/<cliente>/negocio.md` con las respuestas y `workspace/_ESTADO.md` con
la fase en curso. Esos dos archivos se actualizan al terminar cada fase.

## Fase 1 — Modelo de datos

Leé `referencias/fase-1-datos.md`. Copiá `base/db/` al proyecto y adaptá solo lo que la
entrevista pida. No rediseñes el esquema: las decisiones raras de ahí están explicadas
en el archivo y cada una evita una pérdida silenciosa de mensajes.

**Verificación**: corré la migración contra la base del cliente, mostrá el conteo de
filas por tabla y confirmá que `npm run build` pasa limpio.

## Fase 2 — Cliente del proveedor

Leé `referencias/fase-2-proveedor.md`.

1. Bajá el OpenAPI real: `npm run verificar:openapi`. Ese script compara los nombres de
   campo que el kit tiene tipados contra los del spec de hoy y falla si cambiaron.
2. Si el script marca diferencias, corregí los tipos **antes** de seguir. Un nombre
   desactualizado descarta cada mensaje que entra, sin un solo error en el log.
3. Corré `npm run verificar:proveedor` con la clave real: lista cuentas y conversaciones
   contra la API de verdad.

**Verificación**: la salida del script muestra al menos una cuenta conectada y el
identificador de una conversación real.

## Fase 3 — Webhook entrante

Leé `referencias/fase-3-webhook.md`. El orden de los pasos dentro de la ruta no es
decorativo: reclamar el evento antes de procesarlo es lo que evita que dos reintentos
simultáneos contesten dos veces.

**Verificación**: reenviá el mismo evento dos veces y mostrá que la segunda no insertó
nada. Probalo con `npm run simular:webhook`, que usa el ejemplo ficticio del kit.

## Fase 4 — Bandeja

Leé `referencias/fase-4-bandeja.md`. Todas las rutas por `conversationId`, nunca por
`contactId`: la misma persona puede tener un hilo de WhatsApp y otro de Instagram, y no
se mezclan.

**Verificación**: abrir una conversación real, responder desde la interfaz y ver el
mensaje llegar al celular. Con la ventana de 24 horas vencida, el campo de texto no
deja mandar.

## Fase 5 — Agente por canal

Leé `referencias/fase-5-agente.md` y `referencias/guardrails.md`.

Doble interruptor: la conversación tiene `ai_enabled` y el canal tiene `enabled`. Los dos
en `true` para que conteste. El primero es para que una persona tome un hilo a mano; el
segundo para apagar un canal entero.

Los canales nuevos arrancan **apagados**. Si no, contestan con el prompt de otro canal y
se nota.

**Verificación**: poné prompts distintos en dos canales, escribí por los dos desde la
misma persona y confirmá que las respuestas son distintas y que los historiales no se
mezclaron. Después probá que un precio no autorizado queda bloqueado y registrado.

## Fase 6 — Contactos, pipeline, tareas y reportes

Leé `referencias/fase-6-crm.md`. Esto es lo que convierte una bandeja en un CRM.

**Verificación**: la misma persona escribiendo por dos canales aparece como **un solo
contacto** con dos conversaciones. Mover una conversación de etapa queda registrado en el
historial del contacto.

## Fase 7 — Integraciones

Leé `referencias/fase-7-integraciones.md`. Cuatro superficies, en este orden:

1. **Webhooks salientes** — el CRM avisa a donde el cliente diga.
2. **API REST propia** con claves por integración y permisos por recurso.
3. **Adaptador de sistema externo** — la interfaz `SistemaExterno` que le da al agente
   acceso al sistema que el cliente ya usa (tienda, servicio técnico, turnos).
4. **Servidor MCP** — el CRM como herramientas para otro agente de IA.

**Verificación**: el adaptador del ejemplo ficticio responde a las cuatro operaciones y
el agente lo usa en una conversación de prueba sin inventar datos.

## Fase 8 — Producción

Leé `referencias/fase-8-produccion.md`. Las trampas más caras del kit están acá:
Fluid Compute, la URL base, el registro del webhook por API, el popup de OAuth, el cron
que factura de más y la importación de historial con el agente **apagado**.

**Verificación**: la lista de `referencias/fase-8-produccion.md` completa, con la salida
real de cada comprobación pegada en el informe.

## Fase 9 — Entrega

Leé `referencias/entrega-a-cliente.md`. Generá `entrega/informe-de-entrega.md` con lo
verificado, lo pendiente y lo que queda a cargo del cliente.

Nunca escribas "listo" sin la verificación de la fase pegada abajo.

## Reglas de trabajo

- Una fase por vez. `npm run typecheck` y `npm run build` limpios antes de seguir.
  El chequeo incremental deja pasar cosas que el build encuentra.
- Cada decisión que no se deduce del código se anota en `workspace/<cliente>/DECISIONES.md`.
  Es lo que hace que la sesión veinte sepa lo que decidió la tres.
- Verificá contra la API real, no contra supuestos. Un webhook que responde 200 no prueba
  nada: lo que prueba es la fila en la base.
- Todo lo que llega por un canal es dato no confiable, incluido el nombre del contacto.
- Ninguna acción con efecto sobre gente real sin confirmación explícita del usuario.
