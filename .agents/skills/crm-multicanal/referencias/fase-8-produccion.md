# Fase 8 · Producción

Las trampas más caras del kit están todas acá. Ninguna da error.

## Vercel

- **Fluid Compute activo** en Settings → Functions. Sin eso las funciones cortan a los
  60 segundos y el barrido devuelve 504.
- **NO setees `APP_BASE_URL`.** El host sale del request (`urlBase()` en
  `src/lib/entorno.ts`). Una URL fija mal puesta hace que el agente no conteste nunca,
  sin un solo error visible en ningún lado.
- Variables de entorno: todas las de `.env.example` menos las de desarrollo. La
  `SUPABASE_SERVICE_ROLE_KEY` y las claves del proveedor van solo en el entorno de
  producción, nunca en Preview si el repositorio es público.
- **El cron**: el plan gratuito admite **uno por día**, y una expresión más frecuente
  **hace fallar el deploy**. No es un aviso: el deploy no sale.

## El barrido de recuperación

Levanta los eventos reclamados y sin procesar (el `GET` del webhook). Es red de
seguridad, no el camino normal.

Si lo movés a GitHub Actions, ojo con la factura: cobra por minuto **redondeado hacia
arriba** por ejecución, aunque el `curl` tarde diez segundos.

| Frecuencia | Minutos/mes | Costo aproximado |
|---|---|---|
| cada 10 min | 4.320 | ~USD 18,56 (el tramo gratis es 2.000) |
| cada 30 min | 1.440 | gratis |

Cada 30 minutos alcanza de sobra.

## Registro del webhook

```bash
npm run webhook:registrar -- https://tu-crm.vercel.app
```

Por API, no a mano en el panel: busca por nombre y actualiza si ya existe. Los
proveedores no suelen validar URLs duplicadas y terminás recibiendo cada evento dos o
tres veces.

Después, **comprobá que llega de verdad**: mandá un mensaje real y mirá la fila en
`webhook_events`. Que el panel diga "activo" no prueba nada.

## Conexión de cuentas por OAuth

La ventana emergente se abre **sincrónicamente con el click**, antes del `await` que pide
la URL de autorización:

```ts
// bien
const ventana = window.open("", "_blank", "width=600,height=700");
const url = await pedirUrlDeAutorizacion();
if (ventana) ventana.location.href = url;

// mal: el navegador la bloquea como emergente no solicitada
const url = await pedirUrlDeAutorizacion();
window.open(url, "_blank");
```

Después de conectar, sincronizá `channel_accounts`: un webhook cuya cuenta no está en esa
tabla se ignora, y no vas a entender por qué no entra nada.

## Importación de historial

**Esta es la línea más importante de toda la fase.**

Al conectar una cuenta, el proveedor ya tiene conversaciones replicadas que **no llegan
por webhook**. Hay que importarlas:

```bash
npm run importar:historial -- --confirmar
```

El script **no dispara al agente** y no envía nada, a propósito. Una importación con el
agente prendido manda cientos de mensajes reales a gente real, y eso es imposible de
deshacer y muy difícil de explicar.

Antes de importar, confirmá con el usuario. Es una acción con efectos sobre datos de
personas de verdad.

## Lista de verificación de la fase

Pegá la salida real de cada punto en el informe. Sin salida, no está verificado.

- [ ] `npm run build` limpio en local
- [ ] Deploy en Vercel sin errores
- [ ] Fluid Compute activo
- [ ] `APP_BASE_URL` **no** existe en el entorno
- [ ] Todas las variables cargadas, y `SUPABASE_SERVICE_ROLE_KEY` solo en servidor
- [ ] `npm run verificar:proveedor` contra producción
- [ ] Webhook registrado, y una fila real en `webhook_events` tras un mensaje de prueba
- [ ] Reenviar el mismo evento no duplica
- [ ] Cuentas conectadas y sincronizadas en `channel_accounts`
- [ ] Historial importado, con el agente apagado durante la importación
- [ ] Cron del barrido cada 30 minutos o menos frecuente
- [ ] Canales secundarios todavía **apagados** hasta que el negocio revise su guion
- [ ] `db/politicas.sql` aplicado y RLS activo en todas las tablas
