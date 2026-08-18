# Fase 5 · El agente por canal

El runner ya está en `base/src/lib/agente/ejecutar.ts`. Leelo antes de tocar nada: el
orden de los controles es lo que evita que el agente conteste cuando no debe.

## El doble interruptor

- `conversations.ai_enabled` — para que una persona tome **un hilo** a mano.
- `agent_configs.enabled` — para apagar **un canal entero**.

Los dos tienen que estar en `true`. Parecen redundantes hasta la primera vez que un
vendedor necesita tomar una conversación sin apagar el canal entero.

**Los canales nuevos arrancan apagados.** Si no, contestan con el prompt de otro canal
y se nota enseguida.

## La cascada de configuración

`config del canal → config global → default del código`.

Con una excepción que no se toca: **`enabled` NO se hereda del global**. Un canal sin
fila propia está apagado, punto. Heredar eso es exactamente cómo se prende un canal sin
querer.

## El historial

Se filtra por **esa conversación**, nunca por contacto. Si no, el agente mezcla lo que la
persona dijo por Instagram con lo que dijo por WhatsApp, y responde cosas que no cierran.

## Los cuatro controles antes de responder

1. **Evento vencido**: si el evento se generó hace más de 15 minutos, no se contesta.
   Un trabajo que quedó encolado y se procesa una hora después no le puede contestar al
   cliente como si acabara de escribir.
2. **Doble interruptor**.
3. **Ventana de 24 horas**: el agente **nunca** escribe fuera de ventana. Eso lo decide
   una persona.
4. **Agrupación**: espera `buffer_seconds` por si la persona sigue escribiendo. Si
   mientras tanto llegó un mensaje más nuevo, este trabajo se retira y contesta el otro.

## Las herramientas

Están en `base/src/lib/agente/herramientas/`:

| Herramienta | Qué hace |
|---|---|
| `calificar_contacto` | Guarda en la ficha lo que averiguó. Merge, no reemplazo |
| `derivar_a_humano` | Apaga la IA en el hilo, crea la tarea y emite el evento |
| `consultar_sistema` | Consulta el sistema del negocio: pedido, reparación, catálogo, cliente |

Para agregar una: archivo nuevo en esa carpeta, importarla en `index.ts`, y **prenderla
en el canal** (`agent_configs.enabled_tools`). Registrada no significa activa.

La salida siempre va por `entregarMensaje()`. El agente **no escribe en la base a mano**.

## Verificación de la fase

1. Poné prompts distintos en dos canales, escribí por los dos desde la misma persona,
   y confirmá que las respuestas son distintas y que los historiales no se mezclaron.
2. Probá el evento 7 del ejemplo (inyección): el agente no cambia de comportamiento ni
   menciona el intento.
3. Probá una consulta cuyo dato no exista en el sistema: tiene que decir que no lo tiene,
   no completar.
4. Mirá `guardrail_events`: si el modelo intentó decir un precio fuera de lista, tiene
   que haber quedado registrado.
