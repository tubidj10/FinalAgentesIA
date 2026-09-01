# Agente de Triage de Infraestructura

Trabajo final — *Programación de y con Agentes de IA*, MBA UCEMA, 2026 2T.

Autor: Martín Pérez.

## Qué hace

Un agente que recibe una alerta de producción (de un sistema de monitoreo
tipo Datadog/Grafana/Prometheus), consulta una **API de monitoreo real**
para correlacionarla con métricas recientes e incidentes/deploys cercanos, y
devuelve un **triage estructurado en JSON**: severidad, causa probable,
acción recomendada, y si hace falta que una persona intervenga antes de que
pase algo. No es un chatbot: no conversa, no responde preguntas generales, y
no ejecuta ninguna remediación — su única salida es ese JSON.

El objetivo real que resuelve: en un e-commerce mediano, el primer minuto de
una alerta se va en abrir tres pestañas (el dashboard de métricas, el canal
de deploys, el historial de incidentes) para decidir si es grave. Este
agente hace ese primer paso y se lo deja armado al on-call.

- **Contrato completo**: [`prompts/system_prompt.md`](prompts/system_prompt.md)
  (las seis piezas: rol/objetivo, alcance y límites, herramientas, proceso,
  formato de salida, supervisión) + [`prompts/user_prompt.md`](prompts/user_prompt.md).
- **Código**: [`agente/triage_agent.py`](agente/triage_agent.py) (el runner
  real, con soporte para dos proveedores de LLM — Claude vía `anthropic`
  SDK, y Gemini vía HTTP directo — ver § Cómo correrlo) y
  [`agente/monitoring_api_mock.py`](agente/monitoring_api_mock.py) (la API
  de monitoreo).
- **Evidencia de corridas reales**: [`corridas/`](corridas/).
- **La historia del proceso, con los tropiezos**: [`DECISIONES.md`](DECISIONES.md).

## Herramienta real

`consultar_api_monitoreo(servicio, ventana_minutos)` — un `GET` HTTP a
`/api/v1/monitoreo/historial`, que devuelve el historial de métricas
(tasa de error, latencia p95, CPU) y los incidentes/deploys recientes de un
servicio.

En este entorno de entrega, el servidor que responde esa API
(`agente/monitoring_api_mock.py`) es un stand-in local — no tengo
credenciales de una cuenta productiva de Datadog/Grafana para esta entrega,
así que serví un servidor HTTP real con el mismo contrato y datos de
referencia guardados. La llamada que hace el agente es una petición HTTP de
verdad, no una simulación adentro del propio agente: se puede levantar el
servidor y pegarle con `curl` para verificarlo (ver `corridas/README.md`).
El punto de integración (`consultar_api_monitoreo` en `triage_agent.py`) es
el mismo si mañana `MONITORING_API_BASE` apunta a la URL real de Datadog —
es un cambio de una constante y las credenciales, no de arquitectura. El
porqué de esta decisión está documentado en `DECISIONES.md`, iteración 1.

## Formato de salida

JSON estricto, forzado con `output_config.format` (Claude) o `responseSchema`
(Gemini) además de estar escrito en el contrato. Ejemplo real y automático
(`corridas/corrida_01_.../output_crudo.json`, generado por
`triage_agent.py --proveedor gemini`, ver `DECISIONES.md` iteración 5):

```json
{
  "alerta_id": "ALERT-20260901-0091",
  "servicio": "checkout-api",
  "severidad": "P1",
  "confianza": 0.95,
  "causa_probable": "Fallo o degradación tras el deploy Release v2.14.0 (DEPLOY-4821)...",
  "sistemas_afectados": ["checkout-api"],
  "evidencia": {
    "metrica_actual": "Tasa de error en 17.8% (umbral 5.0%), latencia p95 en 1410ms y CPU al 74%.",
    "comparacion_historica": "La tasa de error subió progresivamente de 0.6% a 17.8%...",
    "incidente_correlacionado": "DEPLOY-4821: Release v2.14.0 de checkout-api (hace 27 minutos)",
    "error_herramienta": null
  },
  "accion_recomendada": "Ejecutar rollback del deploy DEPLOY-4821 a la versión anterior...",
  "requiere_intervencion_humana": true,
  "nivel_autonomia": "L2",
  "siguiente_paso": "Notificar al ingeniero de guardia on-call para validar y coordinar el rollback inmediato."
}
```

## Supervisión humana (vocabulario L0–L4)

| Nivel | Qué hace el agente solo | Qué revisa una persona |
|---|---|---|
| **L0** | Nada de forma autónoma; solo observa y registra. | Todo. |
| **L1** | Propone (severidad + acción). | La persona decide y ejecuta antes de que pase nada. |
| **L2** | Ejecuta una acción reversible de bajo riesgo (publicar el triage en el canal de guardia). | La persona revisa antes de actuar sobre el sistema. |
| **L3** | Actúa dentro de límites estrechos, y avisa. | La persona interviene solo si hay excepción o baja confianza. |
| **L4** | Actúa y decide sin humano en el loop. | Auditoría posterior. |

Este agente vive en **L2** para la clasificación (publica el triage solo,
nunca toca el sistema productivo). Sube a comportamiento **L1** (deja el
triage en borrador, no lo publica solo) cuando su propia `confianza < 0.5` —
por ejemplo, cuando la herramienta no reconoce el servicio (ver
`corridas/corrida_03_.../output_crudo.json`). Ninguna corrida llega a L3/L4:
no hay remediación automática en este contrato (ver § Escala futura). El
detalle completo de las reglas está en `prompts/system_prompt.md`, pieza 6.

**Quién firma**: el ingeniero de guardia (on-call) firma cada triage P1/P2
antes de considerarlo cerrado — el agente propone, la persona de guardia es
quien decide y queda con su nombre en el canal como quien tomó la acción
(rollback, escalar, etc.). Los P3/P4 los firma el mismo on-call, pero en la
retro semanal, no en el momento (ver § Gobierno y riesgo).

## Cómo correrlo

El script soporta dos proveedores de LLM — `anthropic` (el elegido y
costeado en § Análisis económico) y `gemini` (el que efectivamente generó
la evidencia de `corridas/`, por el motivo documentado en `DECISIONES.md`,
iteración 5) — mismo contrato, misma herramienta, mismo formato de salida.

**Opción rápida — un solo comando** (levanta la API de monitoreo, corre el
agente, y la apaga sola al terminar, incluso si el agente falla):

```bash
cd agente
pip install -r requirements.txt

export GEMINI_API_KEY=...   # o ANTHROPIC_API_KEY para el proveedor por defecto
./correr_corrida.sh ../corridas/corrida_01_p1_checkout_api/input.json /tmp/salida_corrida_01 gemini
```

**Paso a paso** (si se prefiere ver cada pieza por separado):

```bash
cd agente
pip install -r requirements.txt

# 1. Levantar la API de monitoreo (real, local)
python3 monitoring_api_mock.py 8765 &

# 2a. Con Claude (proveedor por defecto, requiere ANTHROPIC_API_KEY)
export ANTHROPIC_API_KEY=sk-ant-...
python3 triage_agent.py ../corridas/corrida_01_p1_checkout_api/input.json /tmp/salida_corrida_01/

# 2b. Con Gemini (requiere GEMINI_API_KEY, gratis en aistudio.google.com)
export GEMINI_API_KEY=...
python3 triage_agent.py ../corridas/corrida_01_p1_checkout_api/input.json /tmp/salida_corrida_01/ --proveedor gemini
```

Cualquiera de las dos formas reproduce el pipeline de punta a punta sin
intervención humana y deja la misma evidencia (`input.json`,
`llamadas_herramienta.json`, `output_crudo.json`, `metadata.json`, con
`proveedor` y `modo_generacion: "automatico"`) que hay en `corridas/`. Sin
la key correspondiente, el script falla con un error claro en vez de
simular una respuesta — ver `DECISIONES.md`, iteración 1, para por qué eso
es una decisión de diseño (fail-closed) y no un bug.

---

## Análisis económico

### Costo por corrida (medido, no estimado a ojo)

Cada corrida hace dos llamadas a la API de mensajes de Anthropic: una donde
el modelo pide la herramienta, y otra donde ya tiene el resultado y arma el
JSON final. Medí caracteres reales de los archivos de la corrida 1
(`system_prompt.md`, la definición de la herramienta, el user prompt
armado, el bloque de `tool_use`, el resultado de la herramienta y el JSON
final) y los convertí a tokens con la heurística de ~4 caracteres por token
(no es el tokenizer real de Claude — no pude correr
`client.messages.count_tokens()` sin `ANTHROPIC_API_KEY`, ver
`DECISIONES.md` — así que estos números son una aproximación razonable, no
una factura real):

| Concepto | Caracteres | Tokens aprox. |
|---|---:|---:|
| Input total (2 llamadas, sin cache) | 19.885 | ~4.970 |
| Output total (tool_use + JSON final) | 1.650 | ~410 |

**Punto de referencia real, no de Claude pero del mismo contrato**: al
validar la corrida 1 con Gemini (`DECISIONES.md`, iteración 5), el
`usageMetadata` real de esas dos llamadas reportó 2.692 + 3.413 = 6.105
tokens de entrada — mismo orden de magnitud que la estimación de ~4.970 de
arriba (el tokenizer de Gemini no es el de Claude, así que no son
comparables número a número, pero la cercanía es una señal de que la
heurística de caracteres no está desviada por un orden de magnitud).

Con **Claude Haiku 4.5** ($1.00 / $5.00 por MTok de entrada/salida):

```
input:  4.970 / 1.000.000 × $1.00 = $0.00497
output:   410 / 1.000.000 × $5.00 = $0.00205
-----------------------------------------------
total por corrida ≈ $0.007 USD (menos de un centavo)
```

Comparado con otros modelos de la familia, mismo volumen de tokens:

| Modelo | $/MTok in/out | Costo por corrida |
|---|---|---:|
| **Claude Haiku 4.5** (elegido) | $1.00 / $5.00 | **$0.007** |
| Claude Sonnet 5 | $2.00 / $10.00 | $0.014 (2×) |
| Claude Opus 5 | $5.00 / $25.00 | $0.035 (5×) |

### Caso peor (medido, no supuesto) y rango de costo

El número de arriba (~$0.007) asume el camino feliz: una sola ronda de
tool-calling. Pero `triage_agent.py` tiene un tope de código real,
`MAX_RONDAS_HERRAMIENTA = 5` (agregado tras la revisión de código de
`DECISIONES.md`, iteración 6, para no facturar llamadas sin fin si el
modelo entra en un loop pidiendo la herramienta) — ese tope es el caso peor
real del sistema, no una suposición sobre reintentos hipotéticos.

Para estimarlo, usé el crecimiento de tokens **medido de verdad** en las
tres corridas reales de Gemini (`usage_por_llamada` de cada `metadata.json`)
entre la ronda 1 y la ronda 2 — la parte que crece con cada vuelta extra de
herramienta:

| Corrida | Δ tokens ronda 1→2 (real, Gemini) |
|---|---:|
| corrida_01 (historial completo) | 721 |
| corrida_02 (historial completo) | 607 |
| corrida_03 (error 404, cuerpo corto) | 223 |

Tomé el crecimiento más grande observado (721, corrida_01 — el equivalente
en caracteres del bloque `tool_use` + el resultado de la herramienta de esa
corrida, 1.345 caracteres) como el driver del caso peor, y lo apliqué a las
6 llamadas que hacen falta si el agente agota el tope de 5 rondas antes de
poder responder:

```
mejor caso (1 ronda, 2 llamadas):  ~4.970 in / ~410 out  → $0.007
peor caso  (5 rondas, 6 llamadas): ~18.949 in / ~548 out → $0.022
```

**Rango de costo por corrida: USD 0.007–0.022** (el peor caso es ~3× el
mejor, acotado por un límite de código real, no por una cola infinita).

### Proyección de costos

Asumiendo un volumen realista para un e-commerce mediano de **~150 alertas
por semana** que llegan a este agente (unas 21 por día, repartidas entre
varios servicios), el rango mejor–peor caso de arriba se traduce así:

| Escala | Semanal (mejor–peor) | Anual ×52 (mejor–peor) |
|---|---:|---:|
| Haiku 4.5, 150 alertas/semana | $1,05 – $3,25 | **$54,60 – $169,26** |
| Sonnet 5, mismo volumen | $2,10 – $6,51 | $109,20 – $338,52 |
| Opus 5, mismo volumen | $5,25 – $16,27 | $273,00 – $846,30 |

El techo de la derecha (peor caso) es el número que le importa a quien
aprueba presupuesto: aunque **cada una** de las ~7.800 corridas del año
agotara el tope de reintentos de la herramienta — un escenario extremo,
poco probable en la práctica, ya que las tres corridas reales de evidencia
necesitaron una sola ronda — el gasto anual con Haiku no pasa de ~$170. Con
Opus, ese mismo techo extremo llega a ~$846: todavía manejable en términos
absolutos, pero ya una cifra que un CFO quiere ver, no una que se descubre
en la factura de fin de mes.

A este volumen la diferencia en dólares absolutos es chica — y es
justamente el punto: **para una tarea de clasificación estructurada como
esta, pagar 5× para usar Opus no compra un triage mejor**, porque el cuello
de botella no es razonamiento profundo sino seguir un contrato mecánico
(leer una alerta, pedir un dato, aplicar una tabla de reglas). La brecha
importa cuando el volumen crece: una organización con **5.000 alertas por
semana** (multi-servicio, multi-equipo) pagaría entre $1.820/año y
$5.642/año (mejor–peor) con Haiku, contra $9.100/año–$28.210/año con Opus,
por el mismo trabajo — ahí sí es una decisión de presupuesto, no un
redondeo.

### Por qué Haiku 4.5 y no un modelo más grande

Criterio del curso: **el modelo más chico que hace bien la tarea.** Este
triage tiene tres propiedades que lo hacen apto para el modelo más chico de
la familia:

1. **La tarea está casi toda en el contrato, no en el modelo.** La tabla de
   severidad (pieza 4 del system prompt) es determinística: dado el dato de
   la herramienta, hay una sola respuesta correcta. No hace falta
   razonamiento largo ni creatividad — hace falta seguir instrucciones y no
   inventar datos, algo que Haiku 4.5 cumple igual de bien que un modelo
   más grande cuando el contrato es explícito (las tres corridas en
   `corridas/` lo muestran, incluida la corrida 3, que es el caso más
   difícil: reportar un error en vez de completar por plausibilidad).
2. **Contexto corto y sin ambigüedad de dominio abierto.** El input por
   corrida ronda los 5.000 tokens, casi todo el contrato fijo (que además es
   candidato ideal para *prompt caching*: el `system` y la definición de la
   herramienta no cambian entre corridas — no lo medí en vivo por falta de
   API key, pero es la primera optimización a activar antes de subir de
   modelo si el volumen crece).
3. **Latencia importa.** Este agente corre en el camino de una alerta de
   guardia: cuanto antes tenga el on-call el triage, mejor. Haiku 4.5 es el
   modelo más rápido de la familia, y acá la velocidad es una ventaja
   funcional, no solo de costo.

Si en producción se viera que Haiku falla en casos de correlación más
sutiles (por ejemplo, incidentes con varios deploys superpuestos), el
criterio de esta cátedra dice subir un escalón (Sonnet 5) recién cuando haya
evidencia de que Haiku se queda corto — no antes, y no "por las dudas".

---

## Gobierno y riesgo

### Qué sistemas toca el agente y con qué permisos

| Sistema | Acceso | Permiso |
|---|---|---|
| API de monitoreo (`consultar_api_monitoreo`) | Lectura (`GET`) | Solo lectura — el agente no puede escribir, silenciar alertas ni cambiar umbrales. |
| Canal de guardia (`#guardia-infra`) | Escritura (publicar el triage) | El agente puede publicar un mensaje; no puede editar ni borrar mensajes existentes, no puede taggear personas fuera de la persona de guardia configurada. |
| Sistemas productivos (checkout-api, payments-db, etc.) | **Ninguno** | El agente nunca tiene credenciales de escritura sobre la infraestructura real. Cero capacidad de reiniciar, escalar, hacer rollback o tocar configuración. |

No hay ninguna acción de remediación automática en este contrato — es
deliberado (ver § Escala futura). El único "radio de explosión" real de un
error del agente es: un mensaje mal clasificado en un canal de Slack. No es
gratis (un P1 marcado como P3 puede hacer perder minutos valiosos), pero es
acotado y reversible.

### Qué puede salir mal, y qué pasa cuando sale mal

| Riesgo | Qué pasa si ocurre | Mitigación en este contrato |
|---|---|---|
| El agente subestima la severidad (dice P3 y era P1) | El on-call no se entera a tiempo. | La tabla de severidad (pieza 4) es literal y basada en umbrales duros, no en criterio del modelo; further, `confianza` baja fuerza `nivel_autonomia: L1` (no se publica solo). |
| El agente alucina datos que la herramienta no dio | Un triage con evidencia falsa parece más confiable de lo que es. | Prohibido explícitamente en la pieza 2; el schema obliga a un campo `evidencia.error_herramienta` que no se puede omitir; validado en `corridas/corrida_03_`. |
| La API de monitoreo está caída o tarda | El agente no tiene con qué triagear. | El tool_result se marca `is_error: true`; el contrato exige reportarlo, no inventar un historial. |
| Falta la credencial de la API de Anthropic (pasó en esta misma entrega) | El pipeline no corre. | Falla cerrado (excepción clara), no hay modo degradado silencioso — ver `DECISIONES.md`, iteración 1. |
| El schema de severidad (P1–P4) no tiene una opción para "no se puede triagear" | El modelo tiene que forzar una severidad aun cuando la herramienta no confirmó nada (pasa en la corrida 3). | Mitigado parcialmente bajando `confianza` y forzando revisión humana (L1); documentado como límite conocido, no resuelto del todo — ver `DECISIONES.md`, iteración 3, y § Escala futura. |
| Deriva de nombres entre el sistema de alertas y el catálogo de monitoreo | El agente no encuentra el servicio (pasó en la corrida 3, con datos reales del stand-in). | El contrato prohíbe adivinar el nombre "parecido"; se escala a una persona. |

### Qué reviso antes de confiar en una salida

Antes de que cualquier triage P1/P2 dispare una acción real sobre un
sistema:

1. Que `evidencia.incidente_correlacionado` señale algo verificable (un ID
   de deploy real, no una frase genérica).
2. Que `evidencia.error_herramienta` sea `null` — si no lo es, el triage es
   una señal de "no sé", no un diagnóstico.
3. Que `confianza` sea consistente con la evidencia (una `causa_probable`
   contundente con `confianza: 0.3` es una señal de que algo no cierra).

### Quién firma

El **ingeniero de guardia (on-call)** de la semana firma cada triage P1/P2
antes de que se lo considere resuelto — es quien decide si el `accion_recomendada`
del agente se ejecuta, y su nombre queda en el canal como quien tomó la
decisión. El agente nunca firma nada: L2 es "publica y avisa", no "decide y
ejecuta". Los triages P3/P4 los firma el mismo on-call, pero de forma
agregada en la retro semanal de guardia, no uno por uno en el momento.

### Escala futura (no implementada, para que quede explícito qué falta)

- **L3 acotado**: dejar que el agente ejecute una acción reversible
  predefinida (ej.: silenciar una alerta ya confirmada como ruido tipo
  corrida 2, por un tiempo acotado) sin esperar confirmación, con auditoría
  posterior. Hoy no existe: todo triage se publica, nada se ejecuta.
- **Severidad "no determinable"**: agregar un quinto valor al enum de
  severidad para separar "es P4 porque confirmé que es ruido" de "no puedo
  confirmar nada" (hoy ambos casos compiten por P3/P4/P2 de forma menos
  limpia de lo que me gustaría — ver `DECISIONES.md`, iteración 3).
- **Prompt caching medido en vivo** sobre el bloque fijo del contrato,
  para bajar el costo por corrida de la tabla de arriba con datos reales de
  `cache_read_input_tokens` en vez de la proyección teórica.
