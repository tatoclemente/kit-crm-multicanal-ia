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
