# Fase 7 · Integraciones

Cuatro superficies. Las dos primeras hacen al CRM integrable con **cualquier cosa**; la
tercera lo conecta al sistema que el cliente ya usa; la cuarta lo abre a otros agentes.

## 1 · Webhooks salientes

Ya está en `base/src/lib/integraciones/salientes.ts`. El CRM emite a las URLs que el
cliente configure, firmando con HMAC-SHA256 en `X-CRM-Signature` — igual que hace el
proveedor con nosotros.

Eventos: `message.inbound`, `message.outbound`, `conversation.created`,
`conversation.stage_changed`, `conversation.handoff`, `contact.qualified`, `task.created`.

Con esto se enchufa a n8n, Make, Zapier o a un sistema propio sin que nosotros
escribamos un conector por herramienta.

Falta la pantalla de ajustes para darlos de alta y un botón de "mandar evento de prueba".
Mostrá también `outbound_deliveries`: cuando el cliente diga "no me llegó", ahí está la
respuesta.

## 2 · API REST propia

Prefijo `/api/publica/v1/`. Autenticación por clave en `Authorization: Bearer`, contra
`api_keys`.

**Guardamos solo el hash de la clave.** Si alguien lee la base, no se lleva claves
usables. El prefijo se guarda aparte para poder mostrarla en la interfaz sin revelarla.

Permisos por recurso, no una clave que puede todo:

```
conversations:read   messages:read   messages:write
contacts:read        contacts:write  tasks:write
```

Endpoints mínimos: listar y leer conversaciones, listar mensajes, **enviar** un mensaje
(que pasa por `entregarMensaje()`, como todo lo demás), buscar y actualizar contactos,
crear tareas.

Poné límite de frecuencia por clave. Una integración con un bucle mal escrito puede
gastar el saldo del modelo en una tarde.

## 3 · Adaptador del sistema del cliente

Esta es la que más valor da y la que hay que hacer con cuidado.

El contrato está en `base/src/lib/integraciones/tipos.ts` y el ejemplo completo en
`ejemplo-tienda-servicio/adaptador.ts`. Para conectar el sistema real:

1. Copiá el adaptador de ejemplo a `src/lib/integraciones/<sistema>/adaptador.ts`.
2. Cambiá el cuerpo de cada método por la llamada HTTP real. **Bajá primero la
   documentación de esa API**: la regla de no adivinar nombres de campos vale igual acá.
3. Implementá **solo** lo que ese sistema sepa hacer. Lo que dejes sin implementar queda
   apagado y el agente no lo ofrece.
4. Registralo en `registro.ts` y poné `SISTEMA_EXTERNO=<nombre>` en el entorno.

Las tres reglas del adaptador, que están en el contrato y conviene repetir:

- **Nunca tira excepción.** Devuelve `{ ok: false }` y el agente dice que no pudo
  consultar, en vez de que se caiga la respuesta entera.
- **Nunca devuelve más datos de los que el agente necesita decir.** Si la API del cliente
  devuelve el costo interno, el margen o el teléfono de otro cliente, lo recortás ahí.
  Lo que no llega al modelo no se puede filtrar en un mensaje.
- **Filtra por cliente.** Fijate en `consultarPedido` del ejemplo: si el pedido no es de
  esa persona, devuelve `null`. Sin eso, cualquiera que tipee un número de pedido se
  entera de lo que compró otro.

Toda llamada pasa por `llamarSistema()`, que registra en `integration_calls` y corta a
los 8 segundos. Cuando el cliente diga "el agente tarda", eso es lo primero que se mira.

## 4 · Servidor MCP

`base/mcp/servidor.ts` expone el CRM como herramientas para Claude Code, Codex u otro
agente: listar conversaciones, leer una, responder y pausar la IA de un hilo.

`responder` **envía de verdad a una persona real**. La descripción de la herramienta lo
dice explícitamente para que el agente que la use pida confirmación. No agregues
herramientas de escritura masiva.

Para usarlo, en la configuración MCP del entorno:

```json
{ "mcpServers": { "crm": { "command": "npm", "args": ["run", "mcp"], "cwd": "/ruta/al/crm" } } }
```

## Verificación de la fase

1. El adaptador del ejemplo responde a las cuatro operaciones y el agente lo usa en una
   conversación de prueba **sin inventar datos**.
2. Un pedido consultado por quien no es su dueño devuelve "no encontrado".
3. Un webhook saliente de prueba llega firmado y la firma valida del otro lado.
4. Una clave de API sin el permiso `messages:write` recibe 403 al intentar enviar.
5. El servidor MCP lista conversaciones desde otro agente.
