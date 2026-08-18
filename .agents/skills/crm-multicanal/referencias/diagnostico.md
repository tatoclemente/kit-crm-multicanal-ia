# Diagnóstico

Cuando algo no anda, el orden importa: el 90% de las fallas de este CRM son silenciosas
y están en los primeros tres puntos. No toques código antes de recorrer esto.

## "El agente no contesta"

1. **¿Llegó el mensaje?** `select * from webhook_events order by received_at desc limit 5;`
   - No hay filas → el problema es el webhook, seguí en la sección de abajo.
   - Hay filas con `processed_at` en null → murió el trabajo en segundo plano.
2. **¿Se guardó el mensaje?** `select * from messages order by sent_at desc limit 5;`
   - Fila con `body` vacío → los nombres de campo del proveedor cambiaron.
     Corré `npm run verificar:openapi`.
3. **¿Está prendido?**
   `select channel, enabled from agent_configs;` y `select ai_enabled from conversations where id = '...';`
   Los **dos** tienen que estar en true.
4. **¿Está dentro de la ventana?** `select last_inbound_at from conversations where id = '...';`
   Más de 24 horas → el agente no responde, y hace bien.
5. **¿El modelo falló?** Mirá los logs por `[agente] el modelo falló`. Un 402 es saldo
   agotado en OpenRouter; un 429 casi siempre es un modelo `:free`.
6. **¿Lo bloqueó un guardrail?** `select * from guardrail_events order by created_at desc limit 5;`

## "No llega ningún mensaje"

1. `npm run verificar:proveedor` — mirá el `failureCount` del webhook. Si llegó a 10, el
   proveedor **lo apagó** y hay que volver a activarlo.
2. ¿La URL registrada es la de producción y en https?
3. ¿`ZERNIO_WEBHOOK_SECRET` es el mismo en el entorno y en el webhook registrado? Si no
   coinciden, todo devuelve 401 y del lado de ellos figura como fallo.
4. ¿La cuenta está en `channel_accounts` con el `external_id` exacto? Sin match, el
   evento se ignora con 200: el proveedor cree que todo va bien.

## "Contesta dos veces"

Se rompió la idempotencia. Comprobá que exista el índice único:

```sql
select indexdef from pg_indexes where tablename = 'messages';
```

Tiene que estar el parcial sobre `external_id` solo, con `where external_id is not null`.
Si alguien lo cambió a `(provider, external_id)`, ese es el bug.

## "Mezcla conversaciones"

El historial se está armando por contacto en vez de por conversación. Buscá cualquier
consulta que filtre por `contact_id` para armar el historial del agente: tiene que ser
`conversation_id`.

## "Manda mensajes que no figuran" (o al revés)

Hay un segundo camino de salida. Buscá todo `insert into messages` con
`direction = 'outbound'` fuera de `entregarMensaje()`. No debería haber ninguno.

## "Dice precios que no son"

1. ¿`allowed_prices` está cargado para ese canal? Vacío = la regla no bloquea nada.
2. ¿La cifra que dijo es una **derivada** (el mensual de un anual, un redondeo)? Hay que
   agregarla a la lista.
3. Si el precio salió del sistema externo y está mal, el bug es del adaptador, no del
   agente.

## "Va lento"

`select operation, avg(duration_ms), count(*) from integration_calls group by 1;`
Si el sistema externo tarda, el agente tarda. El corte está en 8 segundos.
