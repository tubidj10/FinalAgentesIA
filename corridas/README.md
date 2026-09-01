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

## Modo de generación: por qué dice "asistido_claude_code"

En las tres corridas, la llamada a la herramienta es 100% real: un servidor
HTTP corriendo en `127.0.0.1:8765` respondiendo con datos de un archivo de
fixtures, exactamente como respondería un conector real de monitoreo. Eso se
puede repetir con un `curl` y da byte por byte lo que está en
`llamadas_herramienta.json`.

El paso que en producción sería una llamada a la API de Anthropic
(`agente/triage_agent.py`, función `ejecutar_corrida`) no se pudo ejecutar de
forma desatendida en el entorno de pruebas de esta entrega porque no hay una
`ANTHROPIC_API_KEY` configurada — el intento real, con el traceback completo
del error, está documentado en `DECISIONES.md` (iteración 1). Para no
bloquear la entrega ni inventar una corrida que nunca pasó, el razonamiento
final de estas tres corridas se generó de forma asistida: Claude (el mismo
modelo del contrato, corriendo dentro de Claude Code) leyó el contrato
completo y la respuesta real de la herramienta, y produjo el JSON de salida
seguiéndolo al pie de la letra. Se documenta así, sin disimularlo, en cada
`metadata.json`.

`agente/triage_agent.py` es el script de producción real y completo: con una
`ANTHROPIC_API_KEY` válida, corre estas mismas tres corridas de punta a
punta sin intervención humana y sobrescribe estos mismos archivos con la
salida real de la API. Eso es intencional: la evidencia queda en el mismo
lugar y con el mismo formato tanto si la generó el pipeline automático como
si la generó el modo asistido — lo único que cambia es el campo
`modo_generacion` de `metadata.json`.
