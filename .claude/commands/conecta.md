---
description: Conecta las cuentas de los canales y registra el webhook
---

Leé `referencias/fase-8-produccion.md` antes de tocar nada.
Registrá el webhook por API (`npm run webhook:registrar`), sincronizá `channel_accounts`
y comprobá con un mensaje real que aparece la fila en `webhook_events`.
La importación de historial va con el agente APAGADO y requiere confirmación explícita
del usuario: manda mensajes a personas reales si se hace mal. Canal indicado: $ARGUMENTS.
