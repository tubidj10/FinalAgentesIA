# corridas/ — evidencia de ejecuciones reales

Tres corridas, cada una en su propia carpeta con:

- `input.json` — la alerta de entrada, tal cual.
- `llamadas_herramienta.json` — la(s) llamada(s) reales por HTTP a la API de
  monitoreo (`agente/monitoring_api_mock.py`), con el `input` que armó el
  agente y el `resultado` (status + body) exactamente como respondió el
  servidor.
- `output_crudo.json` — la salida final del agente, en el formato de la
  pieza 5 del contrato.
- `metadata.json` — fecha (UTC), modelo, modo de generación, y los pasos
  exactos para que un tercero reconstruya la corrida.

## Modo de generación: por qué dice "real_api_gemini" y no "claude-haiku-4-5"

En las tres corridas, la llamada a la herramienta es 100% real: un servidor
HTTP corriendo en `127.0.0.1:8765` respondiendo con datos de un archivo de
fixtures, exactamente como respondería un conector real de monitoreo. Eso se
puede repetir con un `curl` y da byte por byte lo que está en
`llamadas_herramienta.json`.

El paso de razonamiento del LLM (`evidencia`, `severidad`, `accion_recomendada`,
etc.) en estas tres corridas **sí es una llamada real y facturada a un LLM**
— pero a la API de Gemini (`agente/triage_agent_gemini.py`), no a la de
Anthropic. El contrato (`prompts/system_prompt.md`) y el análisis económico
del README están escritos y calculados en términos de Claude Haiku 4.5; no
conseguimos una `ANTHROPIC_API_KEY` a tiempo para la entrega (ver
`DECISIONES.md`, iteración 1), así que se usó Gemini como sustituto real —
no simulado — documentado explícitamente en cada `metadata.json`
(`proveedor`, `modelo`, y una nota que remite a `DECISIONES.md`, iteración 5.
`usage_total_tokens` son los tokens reales que reportó la API en esta
corrida, no una estimación).

Estas tres corridas reemplazan una generación anterior en modo
"asistido_claude_code" (sin llamada real a ningún LLM, solo razonamiento de
Claude dentro de Claude Code) — ver `DECISIONES.md`, iteración 5, para el
detalle completo de por qué y qué cambia entre una y otra.

`agente/triage_agent.py` sigue siendo el script de producción real para el
contrato tal como está escrito (Claude Haiku 4.5): con una
`ANTHROPIC_API_KEY` válida, corre estas mismas tres corridas de punta a
punta y sobrescribe estos mismos archivos con la salida real de Anthropic —
el formato de evidencia no cambia según qué proveedor la generó, solo el
campo `proveedor`/`modelo` de `metadata.json`.
