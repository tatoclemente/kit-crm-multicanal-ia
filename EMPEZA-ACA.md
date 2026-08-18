# Empezá acá

Este kit construye un **CRM multicanal con IA**: una bandeja única donde entran y se
responden WhatsApp, Instagram y Messenger, con un agente que contesta solo.

Funciona con Codex, Claude Code, OpenCode o cualquier agente que lea `AGENTS.md`.

## Los tres pasos

1. **Abrí esta carpeta con tu agente** (Codex, Claude Code, OpenCode).
2. **Escribí, en tus palabras**: *"configurá el CRM"*. Te va a comprobar el entorno y a
   hacerte diez preguntas sobre el negocio.
3. **Después**: *"construí el CRM"*. Va por fases, y al final de cada una te muestra la
   verificación antes de seguir.

Si preferís los atajos, en Claude Code y OpenCode están `/setup`, `/construi`,
`/conecta`, `/integra`, `/deploy` y `/revisa`. Siempre hay una frase natural equivalente:
los comandos son opcionales.

## Antes de arrancar, conseguí esto

| Qué | Para qué | Costo |
|---|---|---|
| **Node 20 o superior** | Motor del CRM | Gratis |
| **Cuenta de Supabase** | Base de datos y login | Plan gratis alcanza para empezar |
| **Cuenta de Vercel** | Donde vive la app | Plan gratis alcanza para empezar |
| **Cuenta de Zernio** | Los tres canales en una sola API | Las 2 primeras cuentas conectadas son gratis |
| **Cuenta de OpenRouter** | El modelo del agente | La cuenta es gratis; cargás saldo por uso |
| **Un número de WhatsApp del negocio** | No el personal | Según el proveedor |

Ninguna credencial se pasa por chat. Cuando haga falta, el agente te dice exactamente
dónde escribirla.

## Probalo sin conectar nada

El kit trae un caso ficticio completo. Decile a tu agente:

> Corré el ejemplo de la tienda con servicio técnico y mostrame qué falló.

Prueba el webhook, la idempotencia, la firma, el ruteo, los guardrails y el agente, con
datos inventados y sin mandarle un mensaje a nadie.

## Si algo falla

Decile *"algo no funciona"* y va a recorrer `referencias/diagnostico.md` antes de tocar
código. El 90% de las fallas de este tipo de sistema son silenciosas: no dan error,
simplemente pierden mensajes.
