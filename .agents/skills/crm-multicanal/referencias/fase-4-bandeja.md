# Fase 4 · La bandeja

Es la primera fase donde escribís interfaz. El núcleo de abajo ya está: acá se conecta.

## Reglas de ruteo

**Todas las rutas por `conversationId`, nunca por `contactId`.** Si una persona puede
tener dos hilos, una ruta por contacto los colapsa en uno y se pierde información. Este
cambio es inevitable y es más barato hacerlo ahora que después.

```
/bandeja                      → listado
/bandeja/[conversationId]     → hilo abierto
/contactos/[contactId]        → ficha, con la lista de sus conversaciones
```

## El listado

- Ícono del canal en cada fila. Los iconos de marca ya no vienen en las librerías por
  temas de licencia: hacelos **SVG inline**.
- Filtro por canal y búsqueda por nombre y por usuario.
- El contador de no leídos sale de la **columna** `unread_count`, no de un `COUNT` por
  fila. Con 500 hilos, la diferencia se nota en la primera carga.
- Orden por `last_message_at` descendente.

## El panel de chat

- Las burbujas son **agnósticas del canal**: no las toques por canal.
- El encabezado **sí** cambia: `@usuario` en Instagram y Messenger, teléfono en WhatsApp.
- Escapá siempre el nombre del contacto y el texto del mensaje. Los escribe la persona
  del otro lado: alguien puede llamarse `</script><script>`.
- Fila optimista en estado `pending` mientras el mensaje viaja. El estado real llega
  después por el webhook (`message.delivered`, `message.read`, `message.failed`).

## El envío

Un único endpoint: `POST /api/mensajes/enviar` con `{ conversationId, texto }`, que pasa
por `entregarMensaje()`. Ya está escrito. **No agregues otro lugar que inserte un mensaje
saliente**: ese es el camino a que la interfaz y el agente se desincronicen.

Falta una sola cosa en ese archivo, marcada con `PENDIENTE (Fase 4)`: exigir la sesión de
Supabase Auth y tomar de ahí el usuario que escribe. Hacelo ahora, no después.

## La ventana de 24 horas

El estado lo calcula el **servidor**, con `estadoDeVentana()`, y lo manda al cliente.
Fuera de ventana la interfaz:

- en WhatsApp, ofrece plantilla y deshabilita el texto libre;
- en Instagram y Messenger, avisa que se responde bajo la etiqueta de agente humano y
  hasta cuándo;
- pasados los 7 días, no deja mandar nada.

**No dejes que el campo de texto mande algo que va a rebotar.** Es la peor experiencia
posible: el cliente esperando y el vendedor convencido de que contestó.

## Verificación de la fase

1. Abrir una conversación real, responder desde la interfaz, y ver el mensaje llegar al
   celular o a la cuenta de prueba.
2. Con la ventana vencida (se fuerza poniendo `last_inbound_at` dos días atrás), el
   campo de texto no deja mandar y explica por qué.
3. El listado con 200 conversaciones sembradas carga sin demora perceptible.
