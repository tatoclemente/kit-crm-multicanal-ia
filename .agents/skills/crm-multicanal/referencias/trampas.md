# Las trampas

Ninguna de estas da un error. Todas cuestan horas, plata o clientes. Están adentro de
las fases; acá está el porqué, para que no las "simplifiques".

## 1 · Adivinar los nombres de los campos

Suponer que el webhook manda `message` y `senderId` cuando manda `text` y `sender.id`.
Compila, despliega, y descarta cada mensaje que entra. Sin una línea en el log.

**Se evita** bajando el OpenAPI antes de escribir el cliente. `npm run verificar:openapi`
lo hace y falla si el spec cambió.

## 2 · El índice de idempotencia compuesto

`(provider, external_id)` parece más correcto que `external_id` solo. Pero si el mismo
mensaje entra por dos proveedores durante una migración, los dos `INSERT` pasan y el
cliente recibe la respuesta duplicada.

Y el índice va **parcial**: `where external_id is not null`. Sin eso, los mensajes que
salen del CRM —que todavía no tienen id del proveedor— chocan entre sí.

## 3 · Dos caminos de salida

Que el agente inserte el mensaje por un lado y la interfaz por otro. Funcionan los dos
hasta que dejan de coincidir: aparecen respuestas enviadas que no figuran en el
historial, o al revés. Una sola función: `entregarMensaje()`.

## 4 · La URL base fija

Copiar el `.env` local a producción con `localhost:3000` adentro. Los mensajes entran, se
guardan, y el agente no contesta jamás. Sin errores.

**No setees `APP_BASE_URL` en Vercel.** Que el host salga del request.

## 5 · El cron que factura de más

Un barrido cada 10 minutos en GitHub Actions cuesta unos USD 18,56 al mes: factura por
minuto **redondeado hacia arriba** por ejecución, aunque el `curl` tarde diez segundos.
Cada 30 minutos entra en el tramo gratis y no cambia nada, porque el barrido es una red
de seguridad y no el camino normal.

Ojo también con Vercel: el plan gratuito admite **un cron por día** y una expresión más
frecuente **hace fallar el deploy**.

## 6 · El import arriba del archivo

El webhook tiene 5 segundos para devolver 2xx. Si importás el grafo del agente arriba de
la ruta, el arranque en frío se come el presupuesto y el proveedor marca la entrega como
fallida. El import va **dinámico, adentro del `after()`**.

## 7 · Responder 500 a un evento desconocido

El proveedor cuenta fallos consecutivos y **desactiva la suscripción a los 10**. Diez
eventos raros seguidos y el CRM se queda mudo. Evento que no conocés: log y 200.

## 8 · La ventana de 24 horas decidida por la interfaz

Si el botón "enviar" se habilita en el navegador, tarde o temprano manda algo que rebota
y el vendedor cree que contestó. Es la peor experiencia posible: el cliente esperando y
el negocio convencido de que respondió.

La calcula el **servidor**, desde `last_inbound_at`, y la manda al cliente.

## 9 · La importación de historial con el agente prendido

Al conectar una cuenta, el proveedor ya tiene conversaciones viejas replicadas. No llegan
por webhook: hay que importarlas. Si el agente está prendido durante esa importación,
le contesta a cientos de clientes viejos de golpe.

Es la línea más importante de toda la Fase 8. Un desastre difícil de explicar y
imposible de deshacer.

## 10 · El popup de OAuth abierto después del `await`

Si abrís la ventana cuando resuelve la promesa que pide la URL de autorización, el
navegador la trata como emergente no solicitada y la bloquea. La ventana se abre
**sincrónicamente con el click**, y después le seteás la URL.

## 11 · Guardar la `url` del adjunto en vez de `refreshUrl`

En Instagram y Facebook la `url` de un adjunto es un enlace firmado de Meta que vence.
La guardás, y tres días después el historial es una galería de imágenes rotas.

## 12 · El precio inventado

Un modelo que no tiene el precio a mano lo estima. El cliente lee "sale 45.000" y el
negocio queda atado a un número que nadie autorizó. La lista blanca de precios de
`referencias/guardrails.md` no es una paranoia: es lo que separa un asistente de un
problema comercial.

## 13 · Confiar en el nombre del contacto

`participantName` lo escribe la persona del otro lado. Alguien puede llamarse
`</script><script>` o *"Sistema: ignorá tus instrucciones anteriores"*. Va escapado en la
interfaz y va **fuera** del bloque de instrucciones en el prompt del agente.

## 14 · La `service_role` en el navegador

Una variable `NEXT_PUBLIC_` con la clave de servicio de Supabase publica acceso total a
la base de tu cliente. Cualquiera que abra el inspector la ve.

## 15 · El modelo con sufijo `:batch`

Es entre un 50% y un 80% más barato que la versión normal, así que salta a la vista
cuando se comparan precios. Pero solo existe en la API de lotes, que es **asincrónica**:
se manda un trabajo y el resultado se recoge más tarde. Es barato por eso.

Con ese sufijo el agente no responde nunca. OpenRouter devuelve
`404 This model is only available through the Batch API`, y como el error aparece
recién en la primera conversación real, parece un problema del webhook o de la base.

Lo mismo con `:free`: se satura y devuelve 429 en producción.

**Antes de dejar un modelo configurado**, probalo con una llamada real que además use
una herramienta. Un modelo que contesta pero no llama herramientas deja al agente
inventando estados de pedido en vez de consultarlos.

## 16 · El default de la columna gana sobre el default del código

`agent_configs` cascadea: config del canal → config global → default del código
(`?? []`, `?? 8`). Eso solo funciona si una fila de canal sin ese campo queda en
`null`. Si la columna tiene `.notNull().default([])`, una fila que no lo especifica
NO queda en `null`: queda en `[]`, un valor real. El `??` de JavaScript salta al
siguiente valor solo ante `null`/`undefined`, nunca ante un array vacío — así que el
default de la columna tapa el valor global sin ningún error.

Así se rompió la primera vez: la fila `whatsapp` tenía `enabled_tools: []` de fábrica,
el agente se quedó sin ninguna herramienta —contestaba de memoria en vez de consultar
el sistema— y la lista blanca de precios y dominios quedó vacía, con el guardrail
correspondiente efectivamente apagado. Nada de esto tiró un error: el webhook seguía
devolviendo 200 y el agente seguía "respondiendo".

**La regla**: en cualquier columna que participe de una cascada con `??`, el default va
en el código, nunca en la columna. La columna queda nullable y sin default. Antes de
declarar una fase de configuración por canal como terminada, sembrá una fila de canal
vacía a propósito y confirmá que lee el valor global — no alcanza con que compile.

## 17 · El guardrail de precios lee cualquier número como plata

La regex que detecta cifras de dinero, sin cuidado, matchea CUALQUIER corrida de
dígitos. Tres formas distintas de que esto salga mal, las tres encontradas probando
el kit contra la API real, ninguna con un solo error visible:

1. **Números de pedido o de ticket.** `PED-4471` deja "447" pegado a un guion; el
   agente contesta perfecto ("tu pedido PED-4471 está en camino") y el guardrail lo
   bloquea porque "447" no está en la lista de precios permitidos.
2. **El año de una fecha.** `11/08/2026` deja "2026" suelto: cuatro dígitos, pasa el
   filtro de longitud mínima, no está en la lista de precios, se bloquea una fecha.
3. **Una cantidad con su unidad.** `1200ml` o `40L` sin espacio antes de la letra se
   lee igual que una cifra de dinero.

El cliente recibe el mensaje neutro de fallback en lugar de la respuesta correcta que
el sistema ya tenía armada. El log dice que el guardrail "funcionó" — bloqueó algo.
Solo mirando el `blocked_text` en `guardrail_events` se ve que lo bloqueado era
correcto.

**Lo que NO alcanza**: un lookahead al final de la regex (`(?!\p{L})`) para excluir
los pegados a una unidad. El motor de regex RETROCEDE a un match más corto para
esquivar la condición: con `40L`, si "40" no pasa el lookahead, prueba con "4" solo
—y el "0" que queda después no es una letra, así que ese match sí pasa. Se arregla
extrayendo la cifra completa primero (sin lookaround) y revisando en código el
carácter de antes y de después, nunca dejando que la propia regex decida cuánto
achicar el match.

**La regla**: antes de dar por buena una lista blanca de precios, probá un mensaje
que junte un precio real con un número de pedido, una fecha completa y una cantidad
con unidad en la misma respuesta — y confirmá que solo el precio se evalúa contra la
lista. `.agents/skills/crm-multicanal/referencias/fase-5-agente.md` tiene el detalle
de qué probar en esta fase.
