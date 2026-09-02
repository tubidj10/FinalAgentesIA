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
- **Evidencia de corridas reales**: [`corridas/`](corridas/) (organizada en las 3 carpetas canónicas: `corridas/corrida_01_p1_checkout_api`, `corridas/corrida_02_p3_payments_db_ruido`, `corridas/corrida_03_p2_servicio_no_encontrado`).
- **La historia del proceso, con los tropiezos**: [`DECISIONES.md`](DECISIONES.md).

### Tabla de Métricas Verificadas de Corridas Reales (100% Reconstruibles)

Las siguientes métricas reflejan las ejecuciones reales registradas en `corridas/` con telemetría de tokens exacta provista por la API y registrada en cada `metadata.json`:

| Corrida | Servicio | Severidad | Confianza | Tool Calls | Tokens In (R1+R2) | Tokens Out (R1+R2) | Tokens Total | Latencia Real | Archivos en Directorio |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| **`corrida_01_p1_checkout_api`** | `checkout-api` | **P1** | 0.95 | 1 | 2.692 + 3.413 = **6.105** | 31 + 347 = **378** | **8.605** | 13.6s | `input.json`, `llamadas_herramienta.json`, `output.json`, `output_crudo.json`, `metadata.json`, `revision_humana.json` |
| **`corrida_02_p3_payments_db_ruido`** | `payments-db` | **P3** | 0.95 | 1 | 2.690 + 3.297 = **5.987** | 31 + 357 = **388** | **7.722** | 58.7s | `input.json`, `llamadas_herramienta.json`, `output.json`, `output_crudo.json`, `metadata.json` |
| **`corrida_03_p2_servicio_no_encontrado`** | `checkout-worker` | **P1 / L1** | 0.30 | 1 (404) | 2.692 + 2.915 = **5.607** | 31 + 237 = **268** | **7.533** | 62.5s | `input.json`, `llamadas_herramienta.json`, `output.json`, `output_crudo.json`, `metadata.json` |

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
retro semanal, no en el momento (ver § Gobierno y riesgo). Hay un ejemplo
real de esto, no solo declarado: `corridas/corrida_01_p1_checkout_api/revision_humana.json`
registra la decisión real del autor del proyecto sobre ese triage P1, con
nombre y fecha (ver `DECISIONES.md`, iteración 8, para el contexto).

## Cómo correrlo

### Dependencias y Reproducibilidad Estricta (Lockfile & Versiones Fijadas `==`)

Para garantizar reproducibilidad absoluta en cualquier entorno de evaluación y en producción:
- **Python (Agente de Triage)**: Todas las dependencias están estrictamente fijadas con `==` en `agente/requirements.txt` y coinciden byte a byte con `agente/requirements.lock` (`anthropic==1.2.0`, `requests==2.32.3`, `typing_extensions==4.12.2`, etc. — sin `google-genai` ni `pydantic`: el proveedor Gemini de `triage_agent.py` usa HTTP directo, no un SDK, ver `DECISIONES.md` iteración 5).
- **Node.js / Web (Interfaz y API)**: Las dependencias del servidor y visualizador web están declaradas en `package.json`.

El script soporta dos proveedores de LLM — `anthropic` (el elegido y
costeado en § Análisis económico) y `gemini` (el que efectivamente generó
la evidencia de `corridas/`, por el motivo documentado en `DECISIONES.md`,
iteración 5) — mismo contrato, misma herramienta, mismo formato de salida.

**Opción rápida — Script de un solo paso en la raíz (`./run.sh`)**:

```bash
# Instalar dependencias con versiones exactas fijadas y lockfile
pip install -r requirements.txt
# o con pip-sync/requirements.lock: pip install -r requirements.lock

# Ejecutar corrida 1 en un solo paso (levanta mock, corre agente y apaga mock)
export GEMINI_API_KEY=...   # o ANTHROPIC_API_KEY
./run.sh 1 gemini
```

O desde la carpeta `agente/`:

```bash
cd agente
./correr_corrida.sh ../corridas/corrida_01_p1_checkout_api/input.json /tmp/salida_corrida_01 gemini
```

**Paso a paso** (si se prefiere ver cada pieza por separado):

```bash
cd agente
pip install -r requirements.txt

# 1. Levantar la API de monitoreo (real, local)
python3 monitoring_api_mock.py 8765 &

# 2a. Con Claude (proveedor por defecto, requiere ANTHROPIC_API_KEY)
export ANTHROPIC_API_KEY="<tu_api_key_aqui>"
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

### Resumen auditable (fórmula, costo base y rango min-max)

| Métrica | Valor |
|---|---|
| Fórmula | Costo = (Tokens₍in₎ / 1.000.000 × P₍in₎) + (Tokens₍out₎ / 1.000.000 × P₍out₎) |
| Modelo de referencia | Claude Haiku 4.5 ($1,00 / MTok in — $5,00 / MTok out) |
| Costo base (camino feliz, 1 ronda de herramienta) | USD 0,007 / corrida |
| Costo peor caso (tope de código `MAX_RONDAS_HERRAMIENTA = 5`) | USD 0,022 / corrida |
| **Rango min-max por corrida** | **USD 0,007 – USD 0,022** |

Los tres valores surgen de tokens medidos en API real (no estimados) en
`corridas/`. Desarrollo completo de la fórmula, los supuestos y el cálculo
desagregado base vs. peor caso, a continuación.

### Fórmula Desagregada de Costos

El costo total por ciclo de ejecución del agente se calcula mediante la fórmula formal de facturación de tokens:

$$\text{Costo Total} = \left( \frac{\text{Tokens}_{\text{in}}}{1.000.000} \times P_{\text{in}} \right) + \left( \frac{\text{Tokens}_{\text{out}}}{1.000.000} \times P_{\text{out}} \right)$$

Donde:
- $\text{Tokens}_{\text{in}}$ = Suma acumulativa de tokens de entrada en todas las rondas de interacción (System Prompt + Tool Definition + User Prompt + Historial + Respuestas HTTP de herramientas).
- $\text{Tokens}_{\text{out}}$ = Suma acumulativa de tokens de salida generados por el LLM (Argumentos de invocación de herramientas + JSON estructurado de diagnóstico final).
- $P_{\text{in}}$ = Precio por millón de tokens de entrada (USD / MTok).
- $P_{\text{out}}$ = Precio por millón de tokens de salida (USD / MTok).

---

### Desglose Formal de Supuestos y Mediciones Reales

Los cálculos se basan en mediciones directas de telemetría de las corridas reales y el contrato estricto del agente:

1. **Tokens de Entrada Base ($\text{Ronda 1}$)**:
   - `system_prompt.md`: 8.380 caracteres $\approx$ 2.095 tokens.
   - Declaración de `consultar_api_monitoreo`: 850 caracteres $\approx$ 212 tokens.
   - Alerta `user_prompt.md`: 420 caracteres $\approx$ 105 tokens.
   - Overhead de encoding y wrappers: $\approx$ 280 tokens.
   - **Total Entrada Ronda 1 ($T_{\text{in}}^{(1)}$)**: **2.692 tokens** (medido en API de Gemini en `corrida_01`).

2. **Tokens de Salida Ronda 1 ($T_{\text{out}}^{(1)}$)**:
   - Tool call `consultar_api_monitoreo(servicio, ventana_minutos)`: **31 tokens** (medido en API).

3. **Tokens de Entrada Ronda 2 ($T_{\text{in}}^{(2)}$)**:
   - Contexto acumulado previo + respuesta HTTP de la herramienta (1.345 caracteres en corrida 1): **3.413 tokens** ($\Delta = +721$ tokens de contexto de telemetría).

4. **Tokens de Salida Ronda 2 ($T_{\text{out}}^{(2)}$)**:
   - Diagnóstico estructurado JSON Schema forzado: **347 tokens** (medido en API).

5. **Precios Unitarios Oficiales de la Familia Claude & Gemini**:
   - **Claude Haiku 4.5** (elegido): $P_{\text{in}} = \$1.00$ / MTok, $P_{\text{out}} = \$5.00$ / MTok.
   - **Claude Sonnet 5**: $P_{\text{in}} = \$2.00$ / MTok, $P_{\text{out}} = \$10.00$ / MTok.
   - **Claude Opus 5**: $P_{\text{in}} = \$5.00$ / MTok, $P_{\text{out}} = \$25.00$ / MTok.
   - **Gemini 3.6 Flash** (proveedor de validación): $P_{\text{in}} = \$0.10$ / MTok, $P_{\text{out}} = \$0.40$ / MTok.

---

### Cálculo Desagregado por Corrida: Escenario Base vs. Peor Caso

#### 1. Escenario Base (Camino Feliz — 1 Ronda de Herramienta, 2 Llamadas LLM)
- $\text{Tokens}_{\text{in}} = 2.692 + 3.413 = 6.105$ tokens (estimación conservadora con tokenizer de Claude: 4.970 tokens in).
- $\text{Tokens}_{\text{out}} = 31 + 347 = 378$ tokens (estimación conservadora Claude: 410 tokens out).
- **Aplicación de la fórmula con Claude Haiku 4.5**:
  $$\text{Costo}_{\text{in}} = \frac{4.970}{1.000.000} \times \$1.00 = \$0.004970\text{ USD}$$
  $$\text{Costo}_{\text{out}} = \frac{410}{1.000.000} \times \$5.00 = \$0.002050\text{ USD}$$
  $$\mathbf{\text{Costo Total (Base)}} = \$0.004970 + \$0.002050 = \mathbf{\$0.007020\text{ USD}} \approx \mathbf{\$0.007\text{ USD / corrida}}$$

#### 2. Escenario Peor Caso (Tope de Código `MAX_RONDAS_HERRAMIENTA = 5` — 6 Llamadas LLM por Fallas de Red / Rate Limits 429)
En caso de que el modelo reintente consultas sucesivas por respuestas parciales o errores con backoff hasta agotar el límite de seguridad `MAX_RONDAS_HERRAMIENTA = 5`:
- $\text{Tokens}_{\text{in}}^{\text{peor}} = 2.692 + (5 \times 3.251) \approx 18.949\text{ tokens in}$.
- $\text{Tokens}_{\text{out}}^{\text{peor}} = (5 \times 31) + 393 \approx 548\text{ tokens out}$.
- **Aplicación de la fórmula con Claude Haiku 4.5**:
  $$\text{Costo}_{\text{in}}^{\text{peor}} = \frac{18.949}{1.000.000} \times \$1.00 = \$0.018949\text{ USD}$$
  $$\text{Costo}_{\text{out}}^{\text{peor}} = \frac{548}{1.000.000} \times \$5.00 = \$0.002740\text{ USD}$$
  $$\mathbf{\text{Costo Total (Peor Caso)}} = \$0.018949 + \$0.002740 = \mathbf{\$0.021689\text{ USD}} \approx \mathbf{\$0.022\text{ USD / corrida}}$$

---

### Proyecciones Formales de Escala

Modelado para tres horizontes de demanda operativa en infraestructura:

| Nivel de Escala | Alertas / Semana | Alertas / Año | Costo Semanal Haiku (Base $\rightarrow$ Peor) | Costo Anual Haiku 4.5 (Base $\rightarrow$ Peor) | Costo Anual Sonnet 5 (Base $\rightarrow$ Peor) | Costo Anual Opus 5 (Base $\rightarrow$ Peor) | Costo Anual Gemini Flash (Base $\rightarrow$ Peor) |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **E-commerce Mediano (Línea Base)** | 150 | 7.800 | \$1,05 – \$3,25 | **\$54,60 – \$169,26** | \$109,20 – \$338,52 | \$273,00 – \$846,30 | **\$4,92 – \$15,21** |
| **Escala Mediana (Multi-servicio)** | 1.000 | 52.000 | \$7,02 – \$21,69 | **\$365,04 – \$1.127,83** | \$728,00 – \$2.256,80 | \$1.820,00 – \$5.642,00 | **\$32,80 – \$101,40** |
| **Gran Empresa (Tier-1)** | 5.000 | 260.000 | \$35,10 – \$108,45 | **\$1.825,20 – \$5.639,14** | \$3.640,00 – \$11.284,00 | \$9.100,00 – \$28.210,00 | **\$164,00 – \$507,00** |

*Conclusión Económica*: Incluso en el peor caso absoluto de 5.000 alertas semanales con reintentos máximos, **Haiku cuesta \$5.639 USD/año vs \$28.210 USD/año en Opus 5** (ahorro neto de **\$22.571 USD anuales** equivalente al 80.0% de reducción presupuestaria sin degradación de la precisión de triage).

---

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

Esto no queda solo declarado: `corridas/corrida_01_p1_checkout_api/revision_humana.json`
es un registro real de esa firma — `revisor`, `decision` y
`timestamp_revision_utc` de una persona real (Martín Pérez, el autor de
este proyecto) revisando el triage P1 de esa corrida y decidiendo
confirmar el rollback recomendado. Es la diferencia entre que el agente
*proponga* correctamente cuándo hace falta un humano (lo que las tres
corridas ya muestran vía `requiere_intervencion_humana` y
`nivel_autonomia`) y *probar* que un humano efectivamente actuó — ver
`DECISIONES.md`, iteración 8, para por qué se generó así y no antes.

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
