# Fase 6 · Contactos, pipeline, tareas y reportes

Esto es lo que convierte una bandeja en un CRM. Las tablas ya existen; falta la interfaz
y las reglas.

## Contactos

La ficha del contacto muestra, en una sola pantalla:

- Nombre, teléfono, correo y los campos que capturó el agente (`contacts.fields`).
- **Todas sus conversaciones**, con el ícono de cada canal. Acá se ve el valor de
  `contact_identities`: la misma persona por Instagram y por WhatsApp es un contacto con
  dos hilos, no dos contactos.
- Notas del equipo y etiquetas.
- Si el sistema externo lo reconoce, el enlace a su ficha allá (`external_system_id`).

**Unificar dos contactos a mano** es una operación que el negocio va a pedir: alguien
escribió por Instagram y después por WhatsApp antes de que el agente lo relacionara.
Hacela mover las identidades de un contacto al otro y reasignar las conversaciones, en
una transacción. Nunca borres el contacto viejo sin mover sus conversaciones primero.

## Pipeline

Tablero kanban con las etapas de `pipeline_stages`, en su orden.

- La tarjeta es la **conversación**, no el contacto: la misma persona puede estar
  comprando por un lado y reclamando por otro.
- Arrastrar entre columnas escribe en `stage_history`. Sin ese registro no se puede
  explicar por qué se perdió un lead.
- Las etapas `kind = 'won'` y `kind = 'lost'` cierran: la conversación sale del tablero
  activo pero no se borra.
- El agente puede mover de etapa **solo** si el negocio lo pidió explícitamente. Por
  defecto, mueve una persona.

## Tareas y recordatorios

- Toda derivación a humano crea una tarea (ya lo hace la herramienta `derivar_a_humano`).
- Alerta de conversación sin responder: si `last_inbound_at` es más viejo que X horas y
  no hubo mensaje saliente después, aparece en la lista de pendientes. Que X lo configure
  el negocio: para una guardia de 24 h no es lo mismo que para un local de barrio.
- Nada de notificaciones por mail o WhatsApp en esta fase sin pedírselo al usuario: es un
  envío real y necesita confirmación.

## Reportes

Con lo que ya está en la base alcanza para lo que el negocio realmente mira:

| Métrica | De dónde sale |
|---|---|
| Volumen por canal y por día | `messages` agrupado por `channel` |
| Tiempo hasta la primera respuesta | primer saliente menos `last_inbound_at` del hilo |
| Cuánto resolvió el agente solo | conversaciones sin mensaje de `author = 'human'` |
| Derivaciones | tareas creadas por `created_by = 'agent'` |
| Embudo | conteo por etapa, y `stage_history` para el paso a paso |
| Bloqueos de guardrail | `guardrail_events` |

El proveedor también expone métricas de bandeja (`/v1/analytics/inbox/*`). Sirven para
contrastar, pero **la fuente de verdad del CRM es su propia base**: si el proveedor y la
base no coinciden, hay un mensaje que no se persistió y eso es un bug, no una diferencia
de criterio.

## Verificación de la fase

1. La misma persona escribiendo por dos canales aparece como **un solo contacto** con
   dos conversaciones.
2. Mover una conversación de etapa deja fila en `stage_history` con quién y cuándo.
3. Unificar dos contactos no deja ninguna conversación huérfana.
4. Los números del reporte de un día coinciden con el conteo directo en la base.
