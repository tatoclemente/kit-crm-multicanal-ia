# Fase 9 · Entrega al cliente

Un CRM entregado no es un deploy que anda: es un negocio que puede usarlo sin vos.

## El informe

Generá `entrega/informe-de-entrega.md` con:

1. **Qué quedó funcionando**, canal por canal, con el estado de cada uno (prendido o
   apagado, y por qué).
2. **Qué se verificó**, con la salida real pegada. Cada punto de la lista de la Fase 8.
3. **Qué quedó pendiente** y de quién depende.
4. **Los costos mensuales reales**: proveedor de mensajería, saldo del modelo, Vercel y
   Supabase si pasaron del plan gratis. Con fecha, porque cambian.
5. **Las decisiones** que se tomaron y no se deducen del código (sale de
   `workspace/<cliente>/DECISIONES.md`).

## Lo que hay que mostrarle al negocio, en persona

No alcanza con mandar el link. Sentate y mostrale:

- Cómo tomar una conversación a mano (el interruptor por hilo) y cómo devolverla.
- Cómo apagar un canal entero si algo se va de las manos.
- Dónde se cambian el guion, los precios permitidos y los dominios permitidos.
- La pantalla de bloqueos: qué cosas el agente **no** dijo. Es lo que convence al que
  desconfía de la IA.
- Qué pasa fuera de la ventana de 24 horas, y por qué a veces no se puede escribir
  primero. Esto genera más llamados de soporte que cualquier otra cosa: explicalo antes.

## Las credenciales

- Las claves quedan en el panel de Vercel y en el gestor que use el cliente. **Nunca en
  un mensaje, un mail o un documento compartido.**
- Si el proyecto es del cliente, transferí la titularidad de Vercel y Supabase. Si es
  tuyo y se lo prestás, dejalo por escrito con qué pasa si dejan de trabajar juntos.
- La clave del proveedor es restringida (`zrk_`). Si tuviste que usar una completa para
  algo puntual, rotala antes de entregar.

## Lo que no hay que prometer

- No prometas que el agente "resuelve el 80%". Depende del negocio y de cuántas
  consultas sean repetitivas. Medilo con los reportes después del primer mes.
- No prometas envíos masivos. Ese no es este producto y es la vía rápida a que le
  bloqueen el número.
- No prometas que nunca va a decir algo mal. Los guardrails bajan el riesgo; no lo
  eliminan. Que el negocio sepa dónde mirar cuando pase.

## Después de entregar

Dejale al cliente, por escrito, tres cosas concretas:

1. Cómo apagar todo en 30 segundos (los interruptores de canal).
2. A quién escribirle si algo no anda, y en qué horario.
3. Qué mirar cada lunes: derivaciones sin atender, conversaciones sin responder y
   bloqueos de guardrail.
