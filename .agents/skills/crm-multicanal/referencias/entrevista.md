# Entrevista del negocio

Dos tandas cortas. Escuchá más de lo que preguntes: si el usuario ya contestó algo en su
descripción inicial, no lo vuelvas a preguntar.

## Tanda 1 · Qué es y qué atiende

1. **Nombre del negocio y a qué se dedica**, en una frase.
2. **Qué canales** hay que atender hoy: WhatsApp, Instagram, Messenger. ¿Cuál es el
   principal? Ese arranca prendido; el resto arranca apagado.
3. **Qué pasa hoy cuando alguien escribe**: ¿contesta una persona? ¿en qué horario?
   ¿cuánto tarda? Esto define si el agente reemplaza o acompaña.
4. **Qué quiere que resuelva el agente solo** y qué **nunca** debe resolver solo.
5. **Cuándo tiene que llamar a una persona**: monto, tipo de consulta, cliente enojado,
   pedido de hablar con alguien.

## Tanda 2 · Con qué trabaja

6. **Qué vende y a qué precio.** Anotá moneda, si el precio incluye impuestos, desde
   cuándo rige y cómo se actualiza. Nada de precios en pesos escritos a mano en el
   código: van a la configuración, con fecha.
7. **Qué datos necesita capturar** de cada persona que escribe (nombre, zona, qué busca,
   presupuesto, urgencia). Eso define la ficha del contacto y la herramienta de calificar.
8. **Qué etapas tiene su venta**, en sus palabras. Eso es el pipeline. Si no las tiene
   claras, proponé: Nuevo → Contactado → Presupuestado → Ganado / Perdido.
9. **Qué sistema usa hoy**: planilla, otro CRM, un sistema propio, nada. Si es un sistema
   propio, ¿tiene API? ¿quién la mantiene?
10. **Quiénes van a usar el CRM** y cuántos son. Cada uno entra con su mail.

## Cerrá con la promesa

> El CRM de **[negocio]** atiende **[canales]**, el agente **[qué hace]** y deriva a una
> persona cuando **[condición]**. Los datos que captura van a **[destino]**.

Si no entra en esa frase, el alcance está inflado. Recortá antes de construir.

## Lo que NO se pregunta

- No preguntes qué modelo de IA quiere. Se configura después, por canal, y el default
  del kit sirve para arrancar.
- No preguntes por diseño ni colores en esta instancia: eso va en la Fase 9.
- No pidas credenciales. En la fase que las necesite, le decís dónde ponerlas.

## Guardá el resultado

Escribí `workspace/<cliente>/negocio.md` con las respuestas tal cual, sin adornar.
Ese archivo lo lee el agente en producción para armar su prompt: si lo inflás con
suposiciones, el agente las va a decir como si fueran ciertas.
