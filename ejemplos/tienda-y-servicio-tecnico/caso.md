# Caso ficticio · Tienda Ficticia

Un negocio inventado que sirve para probar todo lo que el CRM tiene que hacer bien.

## El negocio

Tienda Ficticia vende equipamiento de camping por Instagram y por su tienda web, y
además tiene **servicio técnico**: repara lo que vende. Atiende por WhatsApp,
Instagram y Messenger.

Hoy contesta una persona, de 9 a 18. Fuera de ese horario queda todo sin responder
hasta el otro día, y la mitad de las consultas son las mismas tres: "¿llegó mi pedido?",
"¿cómo viene la reparación?" y "¿tenés stock de X?".

## Lo que tiene que resolver el agente solo

- Estado de un pedido, consultando el sistema.
- Estado de una reparación, consultando el sistema.
- Precio y disponibilidad de un producto, consultando el catálogo.
- Tomar los datos de alguien que pregunta por primera vez.

## Lo que nunca resuelve solo

- Reclamos, cambios y devoluciones → deriva a una persona.
- Descuentos y excepciones de precio → deriva.
- Cualquier cosa que no pueda confirmar contra el sistema → lo dice y deriva.

## Las reglas duras del negocio

| Regla | Por qué |
|---|---|
| Los precios que puede decir son solo los del catálogo | Un precio inventado deja al negocio atado a un número que nadie autorizó |
| Solo enlaza a `tienda.ejemplo.test` y `seguimiento.ejemplo.test` | Un enlace a otro dominio es una fuga o una estafa |
| Nunca da datos de un pedido o reparación que no sea de esa persona | Es el dato privado de otro cliente |
| Sin teléfono no puede resolver quién es | En Instagram y Messenger no hay número: hay que pedir otro dato |
| Instagram y Messenger arrancan **apagados** | Se prenden recién cuando el negocio revisó el guion de ese canal |

## Los datos del sistema externo

Están en `base/src/lib/integraciones/ejemplo-tienda-servicio/datos.json`: tres clientes,
tres pedidos, tres reparaciones y cuatro productos. Uno de los productos está **sin
stock** a propósito, y una de las reparaciones **no tiene presupuesto cargado** todavía:
son los dos casos donde el agente tiene que decir "no lo tengo" en vez de completar.
