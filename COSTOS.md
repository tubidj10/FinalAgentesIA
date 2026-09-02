# Análisis económico — Agente de Triage de Infraestructura

Este archivo consolida en un solo lugar la fórmula de costo, los supuestos
de medición y el rango min-max por corrida. El detalle completo del
desglose (tokens por ronda, precios por modelo, proyecciones de escala) y
el razonamiento de por qué Haiku 4.5 es el modelo elegido están en
`README.md`, sección "Análisis económico" — este archivo no reemplaza esa
sección, la resume para auditoría rápida.

## Fórmula de costo

$$\text{Costo Total} = \left( \frac{\text{Tokens}_{\text{in}}}{1.000.000} \times P_{\text{in}} \right) + \left( \frac{\text{Tokens}_{\text{out}}}{1.000.000} \times P_{\text{out}} \right)$$

Donde `Tokens_in`/`Tokens_out` son la suma acumulada de tokens de entrada y
salida de todas las rondas de interacción (system prompt, definición de
herramienta, user prompt, historial, respuestas HTTP de la herramienta, y
argumentos/JSON generados por el LLM), y `P_in`/`P_out` son el precio por
millón de tokens del modelo usado.

## Supuestos y mediciones reales

- Medido en API real (Gemini), no estimado: `corrida_01` — 2.692 tokens de
  entrada / 31 de salida en la ronda 1; +721 tokens de entrada / 347 de
  salida en la ronda 2 (tras la respuesta de la herramienta).
- Modelo de referencia para el costo en producción: **Claude Haiku 4.5**
  ($1,00 / MTok in — $5,00 / MTok out).
- Tope de código `MAX_RONDAS_HERRAMIENTA = 5` (definido en
  `agente/triage_agent.py`): define el peor caso ante reintentos por
  errores de red o rate limits (HTTP 429).

## Costo por corrida: base vs. peor caso

| Escenario | Tokens in | Tokens out | Costo (Haiku 4.5) |
|---|---:|---:|---:|
| Base (camino feliz, 1 ronda de herramienta, 2 llamadas LLM) | 4.970 | 410 | USD 0,007 |
| Peor caso (tope `MAX_RONDAS_HERRAMIENTA = 5`, 6 llamadas LLM) | 18.949 | 548 | USD 0,022 |

**Rango min-max por corrida: USD 0,007 – USD 0,022.**

## Proyección de escala (Haiku 4.5, base → peor caso)

| Nivel de escala | Alertas/semana | Costo anual |
|---|---:|---:|
| E-commerce mediano | 150 | USD 54,60 – USD 169,26 |
| Escala mediana (multi-servicio) | 1.000 | USD 365,04 – USD 1.127,83 |
| Gran empresa (Tier-1) | 5.000 | USD 1.825,20 – USD 5.639,14 |

Desglose completo de estos cálculos, comparación contra Sonnet 5/Opus 5/
Gemini Flash, y el criterio de elección del modelo: `README.md`, sección
"Análisis económico".
