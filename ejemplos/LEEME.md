# Ejemplo de práctica

Un caso completo, con datos totalmente ficticios, para probar el CRM de punta a punta
sin conectar ninguna cuenta real ni gastar un peso en mensajes.

## Cómo se activa

Decile al agente, en lenguaje natural:

> Corré el ejemplo de la tienda con servicio técnico y mostrame qué falló.

O a mano:

```bash
cd base
npm install
npm run db:migrate
npm run sembrar:ejemplo
npm run dev
```

Y en otra terminal:

```bash
npm run webhook:simular
```

## Qué necesita

- Una base Postgres de prueba (un proyecto gratis de Supabase alcanza) en `DATABASE_URL`.
- `ZERNIO_WEBHOOK_SECRET` con cualquier cadena de 16 caracteres o más: el simulador
  firma con esa misma.
- `OPENROUTER_API_KEY` **solo** si querés ver al agente responder de verdad. Sin ella,
  igual se prueban el webhook, la idempotencia, la firma, el ruteo y la persistencia,
  que es la mitad de lo que puede fallar.

**No hace falta** ninguna cuenta del proveedor de mensajería: las cuentas del ejemplo
son ficticias y el simulador manda los eventos directo al webhook.

## Qué contiene

- `tienda-y-servicio-tecnico/caso.md` — el negocio ficticio y sus reglas.
- `tienda-y-servicio-tecnico/eventos.json` — 15 eventos de webhook, cada uno con una
  trampa concreta anotada.
- `tienda-y-servicio-tecnico/resultado-esperado.md` — qué tiene que pasar con cada uno.
  Es la lista contra la que se compara.

Los datos del sistema externo ficticio (pedidos, reparaciones, catálogo) están en
`base/src/lib/integraciones/ejemplo-tienda-servicio/datos.json`.

## La regla del ejemplo

Ninguna persona, número, pedido ni cuenta de este ejemplo existe. Todos los dominios
terminan en `.test`, que está reservado justamente para esto y nunca resuelve a un sitio
real. **Nunca reemplaces estos datos por datos de un cliente de verdad para probar.**
