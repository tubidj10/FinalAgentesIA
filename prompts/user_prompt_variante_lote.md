# User prompt — variante: resumen de guardia (lote, no usada en las corridas de evidencia)

Variante evaluada durante el diseño (ver `DECISIONES.md`, iteración 2) para un
caso de uso distinto: en vez de triagear una alerta a la vez, resumir todas las
alertas abiertas al cierre de un turno de guardia. Se documenta acá porque el
curso pide dejar constancia de las variantes exploradas, no porque esté en
producción — **las tres corridas de evidencia usan la plantilla principal**
(`user_prompt.md`), no esta.

```
Es el cierre del turno de guardia de las {{hora}}. Estas son las alertas que
quedaron abiertas en las últimas {{horas_turno}} horas:

{{lista_alertas_json}}

Para cada una, triageala con el mismo contrato de siempre (una llamada a
consultar_api_monitoreo por alerta como mínimo). Al final, además del JSON de
cada alerta, agregá un bloque `resumen_turno` con: cuántas son P1/P2/P3/P4 y
cuáles requieren handoff explícito al próximo turno.
```

Se descartó para el alcance de esta entrega porque el schema de salida (pieza
5 del contrato) tendría que soportar una lista + un resumen agregado, lo que
duplica la superficie de validación sin agregar valor para las tres corridas
de evidencia pedidas. Queda anotado como próximo paso natural en el README
(§ Escala futura).
