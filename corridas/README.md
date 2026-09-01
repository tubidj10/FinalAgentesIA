# corridas/ — evidencia de ejecuciones reales

Tres corridas, cada una en su propia carpeta con:

- `input.json` — la alerta de entrada, tal cual.
- `llamadas_herramienta.json` — la(s) llamada(s) reales por HTTP a la API de
  monitoreo (`agente/monitoring_api_mock.py`), con el `input` que armó el
  agente y el `resultado` (status + body) exactamente como respondió el
  servidor.
- `output_crudo.json` — la salida final del agente, en el formato de la
  pieza 5 del contrato.
- `metadata.json` — proveedor, modelo, fecha (UTC), modo de generación, uso
  de tokens real, y los pasos para que un tercero reconstruya la corrida.

## Estado actual: las tres son 100% automáticas y reales

Cada corrida hizo dos cosas de verdad, sin ningún paso simulado:

1. **La llamada a la herramienta** (`consultar_api_monitoreo`): un `GET`
   HTTP real contra `agente/monitoring_api_mock.py` corriendo en
   `127.0.0.1:8765`. Reproducible byte a byte con `curl` usando el `input`
   de `llamadas_herramienta.json` de cada carpeta, por ejemplo:
   `curl "http://127.0.0.1:8765/api/v1/monitoreo/historial?servicio=checkout-api&ventana_minutos=30"`.
2. **El razonamiento del LLM**: una llamada real a la API de Gemini
   (`gemini-3.6-flash`), con tool-calling real y salida forzada por
   `responseSchema` — `metadata.json` trae `modo_generacion: "automatico"` y
   `usage_por_llamada` con los tokens tal como los devolvió la API, no
   estimados.

`agente/triage_agent.py --proveedor gemini` es exactamente el comando que
generó estos archivos; correrlo de nuevo con `GEMINI_API_KEY` seteada los
reproduce (con la variabilidad normal de un LLM: mismo contrato, mismo tool
result, redacción y — en algún caso — hasta la severidad puede no salir
idéntica; ver `DECISIONES.md`, iteración 5, para un caso real donde eso
pasó).

## Por qué Gemini y no Anthropic, si el contrato es de Claude

El contrato (`prompts/`) y el análisis económico del README están pensados
para Claude — es el proveedor que se elegiría en producción. La cuenta de
Anthropic disponible para esta entrega tiene bloqueada la creación de API
keys por política de la organización (no es una limitación del entorno de
pruebas, como sí lo fue en la primera versión de este repo — ver
`DECISIONES.md`, iteración 1). Gemini fue la vía real y accesible para
validar el pipeline de punta a punta sin esa restricción.

`agente/triage_agent.py --proveedor anthropic` (el default) sigue intacto y
completo: con una `ANTHROPIC_API_KEY` válida, corre exactamente el mismo
contrato contra Claude y sobrescribe estos mismos archivos, con
`modo_generacion: "automatico"` y `proveedor: "anthropic"` en el
`metadata.json` resultante — el formato de la evidencia no depende de qué
proveedor la generó.

Detalle completo de la decisión, los dos errores reales encontrados
integrando Gemini (modelo dado de baja, rol inválido en la respuesta de la
herramienta) y las diferencias observadas entre la versión manual anterior
y esta corrida automática: `DECISIONES.md`, iteración 5.
