# Fase 3 · Webhook entrante

La ruta ya está escrita en `base/src/app/api/webhooks/zernio/route.ts`. Leela entera
antes de tocarla: **el orden de los pasos no es decorativo**.

## El orden, y por qué

1. **Body crudo y firma.** Si parseás el JSON y lo volvés a serializar, la firma nunca
   valida: cambian los espacios y el orden de las claves. Sin firma válida: 401.
   Sin secreto configurado: 401 también. *Fail-closed*, nunca *fail-open*.

2. **Reclamar el evento** en `webhook_events` con `INSERT ... ON CONFLICT DO NOTHING
   RETURNING`. Si no insertó, es un reintento: 200 y cortás.
   Reclamar **antes** de procesar es lo que evita que dos reintentos simultáneos
   contesten dos veces.

3. **Rutear por la cuenta** contra `channel_accounts`. Sin match: 200 e ignorar. No es
   un error: es un evento de otra cuenta del mismo proveedor.

4. **Resolver el contacto** por `contact_identities`, crear o actualizar la conversación,
   insertar el mensaje. Todo esto es un `INSERT`: va inline, antes de responder.

5. **Encolar el trabajo del agente** después de responder, adentro de `after()`, con
   **import dinámico**. Si el import va arriba del archivo, el arranque en frío se come
   los 5 segundos de presupuesto y el proveedor marca la entrega como fallida.

6. **Devolver 200.**

## Lo que nunca se hace acá

- **Nunca 500** en un evento desconocido: log y 200. El proveedor cuenta fallos
  consecutivos y desactiva la suscripción a los 10. Diez respuestas de error seguidas
  y el CRM se queda mudo sin que nadie se entere.
- **Nunca** llamar al agente antes de responder.
- **Nunca** confiar en `participantName`: lo escribe la persona del otro lado.

## El endpoint GET

La misma ruta tiene un `GET` protegido por `CRON_SECRET` que levanta los eventos
reclamados pero **sin procesar**. Es la red de seguridad para cuando el trabajo en
segundo plano muere a mitad de camino: el evento quedó reclamado (no se va a reintentar
solo) pero nadie lo terminó.

Acepta `Authorization: Bearer <secreto>` y `X-Cron-Secret: <secreto>`, porque no todos
los ejecutores de cron dejan mandar el primero.

## Verificación de la fase

```bash
npm run dev
npm run webhook:simular
```

El script manda los eventos ficticios de `ejemplos/tienda-y-servicio-tecnico/eventos.json`
firmados, y después **repite el primero a propósito**.

Tiene que pasar esto:

1. La primera vez: `{"ok":true}` y una fila nueva en `messages`.
2. La segunda vez del mismo evento: `{"ok":true,"reintento":true}` y **el conteo de
   mensajes no sube**.
3. Un evento con firma mal: 401.
4. Un evento de una cuenta que no está en `channel_accounts`: 200, sin fila.

Corré el conteo antes y después y mostrá los dos números. "Responde 200" no prueba nada:
lo que prueba es la fila en la base.
