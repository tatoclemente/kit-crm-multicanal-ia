# Fase 2 · Cliente del proveedor

El cliente ya está escrito en `base/src/lib/canales/`, tipado contra el OpenAPI real.
Tu trabajo es **comprobar que sigue siendo cierto** y conectarlo con las credenciales
del cliente.

Antes de leer esto, leé `zernio-verificado.md`: es la foto con fecha de lo que
verificamos y de dónde salió cada nombre de campo.

## Lo primero, siempre

```bash
npm run verificar:openapi
```

Baja el spec de hoy y compara los nombres que el kit da por ciertos. Si algo falta:
**parás acá**. Arreglás `src/lib/canales/zernio/tipos.ts` y `mapeo.ts`, actualizás
`zernio-verificado.md` con la fecha nueva, y recién después seguís.

Un nombre mal adivinado no rompe el build. Descarta cada mensaje que entra, sin un solo
error en el log. Es la falla más cara del proyecto y la más difícil de encontrar después.

## Las credenciales

En el panel del proveedor, creá una **clave restringida** (`zrk_`) con los grupos
`messages`, `accounts` y `webhooks`. Nada más. Una clave completa (`sk_`) da acceso a
publicar, a anuncios y a facturación: el CRM no necesita nada de eso, y si se filtra,
el daño es de otro tamaño.

La clave va a `.env.local`. No la pidas por chat, no la pegues en un mensaje y no la
escribas en un archivo que vaya a un repositorio.

## La estructura del cliente

| Archivo | Qué hace |
|---|---|
| `zernio/cliente.ts` | fetch nativo, sin SDK. Devuelve `Resultado`, nunca tira excepción |
| `zernio/tipos.ts` | Las **dos** familias de tipos: REST y webhook. No las unifiques |
| `zernio/mapeo.ts` | Traduce cada familia al dominio del CRM |
| `zernio/bandeja.ts` | Conversaciones, mensajes, envío, apertura de hilo |
| `zernio/cuentas.ts` | Cuentas conectadas |
| `zernio/webhooks.ts` | Firma HMAC y alta del webhook por API |
| `registro.ts` | Selección del proveedor. Acá se agrega otro |

Sin SDK a propósito: se usan ocho endpoints. Un SDK agrega superficie de dependencia y
acoplamiento de versión a cambio de nada.

## Verificación de la fase

```bash
npm run verificar:proveedor
```

Tiene que listar al menos una cuenta conectada y, si ya hubo conversaciones, el id de
alguna. Pegá la salida real en el informe. Si el negocio todavía no conectó ninguna
cuenta, esta fase queda **parcial** y se anota como pendiente: no la declares terminada.

## Si mañana hay que cambiar de proveedor

Escribís otro módulo que cumpla `ProveedorDeCanales` (en `canales/tipos.ts`) y lo
agregás al mapa de `registro.ts`. Nada más del CRM cambia. Por eso `provider` es una
columna propia y por eso el índice de idempotencia va sobre `external_id` solo.
