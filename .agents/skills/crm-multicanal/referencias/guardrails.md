# Guardrails

La capa que se aplica a toda respuesta antes de que salga. Está en
`base/src/lib/agente/guardrails.ts` y se configura por canal.

No es paranoia. Un modelo que no tiene el precio a mano lo estima; el cliente lee
"sale 45.000" y el negocio queda atado a un número que nadie autorizó.

## Qué revisa la salida

| Regla | Qué bloquea |
|---|---|
| `fuga-de-prompt` | Que aparezca el código canario en una respuesta |
| `precio-no-autorizado` | Cualquier cifra de dinero que no esté en la lista blanca |
| `enlace-no-autorizado` | Cualquier dominio que no sea del negocio (`wa.me` siempre pasa) |
| `enlace-ilegible` | Una URL que ni siquiera se puede interpretar |

Cuando algo se bloquea: el mensaje no sale, en su lugar va el texto de respaldo, y queda
la fila en `guardrail_events` con la regla, el detalle y el texto bloqueado.

## Cómo se configura

En `agent_configs`, por canal:

- **`allowed_prices`** — las cifras que el agente puede decir. **Incluí también las
  derivadas**: si vendés a 497.000 al año y querés que diga "sale unos 41.000 por mes",
  las dos tienen que estar. Si la lista está vacía, la regla no bloquea nada.
- **`allowed_hosts`** — los dominios del negocio. Los subdominios entran solos.
- **`fallback_message`** — lo que recibe la persona cuando algo se bloquea. Que suene
  natural: "Dejame confirmar eso y te respondo", no un mensaje de error.

Y en el entorno:

- **`CODIGO_CANARIO`** — una cadena única y secreta. Se pone también al final del prompt
  del negocio. Si aparece en una respuesta, el modelo está recitando sus instrucciones.

## Qué revisa la entrada

`revisarEntrante()` trunca lo desmedido antes de gastar tokens. Es lo que evita que
alguien pegue 200 KB de texto y la respuesta cueste veinte veces lo normal.

## Lo que los guardrails NO hacen

- No detectan una mentira que no sea un precio ni un enlace. Contra eso, la defensa es
  que el agente consulte el sistema en vez de estimar.
- No reemplazan al prompt: son la red de abajo, no la primera línea.
- No filtran contenido ofensivo entrante. Si el negocio lo necesita, eso es otra capa y
  hay que decidirla con el cliente.

## Al entregar

Mostrale al cliente la pantalla de bloqueos. Un negocio que desconfía de la IA cambia de
opinión cuando ve que hay un registro de todo lo que el agente **no** dijo.
