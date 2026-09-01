# DECISIONES.md — la historia del proceso

Este documento no es un resumen prolijo escrito al final. Es el registro de
lo que fue pasando mientras construía el Agente de Triage de Infraestructura,
en orden, con lo que falló incluido. Cada iteración dice qué problema
apareció, qué decisión tomé y por qué.

---

## Iteración 1 — El agente no tiene con qué llamar a Claude en este entorno

**Fecha**: 2026-09-01.

El plan original era simple: `agente/triage_agent.py` llama a la API de
Anthropic con `anthropic.Anthropic()` (credenciales resueltas del entorno) y
corre de punta a punta sin que yo tenga que intervenir. Antes de generar la
evidencia de las tres corridas, corrí el script tal cual contra una alerta
real:

```
$ python3 triage_agent.py /tmp/test_corrida/input.json /tmp/test_corrida/
...
TypeError: "Could not resolve authentication method. Expected one of
api_key, auth_token, or credentials to be set. Or for one of the
`X-Api-Key` or `Authorization` headers to be explicitly omitted"
```

Fallo real, no hipotético: el entorno de pruebas de esta entrega no tiene
`ANTHROPIC_API_KEY` configurada para llamados HTTP directos a
`api.anthropic.com`. Para confirmar que no era un problema de mi código sino
específicamente de credenciales, probé de nuevo con una clave inválida a
propósito:

```
$ ANTHROPIC_API_KEY="sk-ant-clave-de-prueba-invalida-000" python3 triage_agent.py ...
...
anthropic.AuthenticationError: Error code: 401 - {'type': 'error', 'error':
{'type': 'authentication_error', 'message': 'API key is invalid.'},
'request_id': None}
```

Esto confirma que `api.anthropic.com` es alcanzable desde este entorno y que
el script arma el request correctamente — el único problema es no tener una
clave válida. Dos decisiones de alcance salieron de este tropiezo:

1. **`triage_agent.py` falla cerrado, a propósito.** No le agregué un modo
   "simulado" que devuelva una respuesta inventada si falta la clave — eso
   sería peor que el error actual, porque escondería el problema. Un
   pipeline de triage que "sigue andando" sin poder razonar de verdad es más
   peligroso que uno que se cae con un traceback claro. Esto quedó
   documentado también en el README, § Gobierno y riesgo, como una
   propiedad de diseño, no como una limitación a pedir disculpas.
2. **El paso de razonamiento de las tres corridas de evidencia se generó en
   "modo asistido"**: Claude (el mismo modelo del contrato, corriendo dentro
   de Claude Code, en esta misma sesión) leyó el contrato completo y la
   respuesta real de la herramienta para cada alerta, y produjo el JSON de
   salida siguiéndolo al pie de la letra — sin inventar una corrida que
   nunca pasó, y dejándolo dicho explícitamente en cada `metadata.json` de
   `corridas/`. La parte de la herramienta (`consultar_api_monitoreo`) sí es
   100% real: un servidor HTTP corriendo en `127.0.0.1:8765` respondiendo
   con datos reales de fixture, reproducible por un tercero con `curl`.

También decidí, por el mismo motivo de falta de credenciales, servir la API
de monitoreo con un **stand-in local** (`agente/monitoring_api_mock.py`) en
vez de contra una cuenta productiva de Datadog/Grafana — no tengo acceso a
una cuenta de monitoreo real de un e-commerce para esta entrega. El stand-in
expone el mismo contrato HTTP (`GET /api/v1/monitoreo/historial`) que usaría
un conector real, así que el punto de integración en el código no cambia si
mañana esto apunta a Datadog: cambia una URL y una credencial, no la
arquitectura del agente.

---

## Iteración 2 — Una plantilla de usuario, no dos

Al diseñar `prompts/user_prompt.md` consideré dos casos de uso: (a) triagear
una alerta a la vez (el caso real de este agente) y (b) armar un resumen de
cierre de turno de guardia con todas las alertas abiertas en lote. Escribí
un borrador de la variante (b) — está guardada en
`prompts/user_prompt_variante_lote.md` porque el enunciado pide dejar
constancia de las variantes exploradas — pero la descarté para esta entrega
por dos razones concretas:

- El schema de salida (pieza 5 del contrato) tendría que soportar una lista
  de triages + un bloque agregado (`resumen_turno`), lo que duplica la
  superficie de validación sin agregar valor para las tres corridas de
  evidencia pedidas.
- Mezclar ambos casos en un solo contrato hacía más difícil verificar la
  regla de "una llamada a la herramienta como mínimo" (pieza 3), porque en
  el caso de lote son N llamadas, una por alerta, y la lógica de reintentos
  se vuelve ambigua.

Decisión: un solo `user_prompt.md` en producción, alcance acotado a una
alerta por corrida. La variante de lote queda anotada en el README como
próximo paso natural, no como parte de este entregable.

---

## Iteración 3 — El límite real del schema: severidad forzada sin datos

**Contexto**: al armar la corrida 3 (una alerta que referencia
`checkout-worker`, un nombre de servicio que no existe en el catálogo de la
API de monitoreo — un caso realista de desalineación entre el sistema de
alertas y el catálogo de monitoreo), escribí primero una versión del
contrato (v1.0) que **no** tenía las reglas explícitas de la pieza 2
("no inventés datos que no vinieron de la herramienta") ni el campo
obligatorio `evidencia.error_herramienta` en el schema de salida.

Al razonar ese caso con el v1.0 del contrato en la cabeza, el patrón de
fallo es predecible y es un riesgo real y conocido de agentes con
tool-calling: ante un error 404 de la herramienta, sin una regla explícita
que lo prohíba, lo más fácil para un modelo es completar el hueco con datos
plausibles (inventar un historial de métricas razonable para
"checkout-worker" en vez de decir "no lo sé") — una alucinación clásica por
omisión de contrato, no por capacidad del modelo. No dejé pasar esa versión
a evidencia: la corregí antes de generar ninguna corrida real con ella,
así que no hay un "output_crudo.json fallado" guardado — lo que sí queda es
el motivo documentado acá y las reglas que agregué para prevenirlo:

- Pieza 2 (alcance y límites): "No inventás datos que no vinieron de la
  herramienta ni de la alerta original... nunca lo completás por
  plausibilidad."
- Pieza 3 (herramientas): "Si la herramienta responde
  `servicio_no_encontrado`, no lo reintentés con un nombre 'parecido'
  inventado por vos: reportá el error tal cual."
- Schema de salida: `evidencia.error_herramienta` es un campo **obligatorio**
  (puede ser `null`, pero tiene que estar presente) — obliga a que la
  ausencia de datos quede explícita en la estructura, no en el texto libre
  donde es fácil que se pierda.

Con estas reglas (v1.2, la que está en `prompts/system_prompt.md` hoy), la
corrida 3 (`corridas/corrida_03_p2_servicio_no_encontrado/`) hace lo
correcto: reporta el 404 tal cual en `evidencia.error_herramienta`, no
inventa métricas para un servicio que no existe, baja `confianza` a 0.3 y
fuerza `nivel_autonomia: "L1"` (no se publica solo, queda para que una
persona lo confirme).

**Límite que quedó sin resolver, documentado en vez de escondido**: el enum
de `severidad` (`P1`–`P4`) no tiene un valor para "no se puede determinar".
En la corrida final automática (iteración 5, con Gemini) el modelo resolvió
esto asignando `P1` — aplicando la tabla de la pieza 4 en forma literal sobre
el valor que reportó la alerta (22% > 15%, "sin explicación histórica
conocida" porque la herramienta no confirmó nada), no porque haya podido
verificar realmente que es grave. En un borrador anterior, razonado a mano
por mí con el mismo contrato, yo había elegido `P2` como punto medio
conservador — una interpretación distinta de la misma ambigüedad, ninguna de
las dos "incorrecta" contra la letra del contrato. Ese desacuerdo entre mi
lectura y la del modelo es la prueba misma del límite: el schema no tiene
una salida honesta para "no sé la severidad, sé que no pude confirmar nada",
así que dos lectores razonables del mismo contrato llegan a valores
distintos. Lo mitigo bajando `confianza` (0.3) y forzando revisión humana
(`nivel_autonomia: "L1"`), pero es un parche, no una solución de schema.
Cambiar el enum implica re-validar las otras dos corridas y el schema
completo, así que lo dejé como primer ítem de escala futura en el README en
vez de resolverlo apurado a último momento.

---

## Iteración 4 — Medir el costo real en vez de estimarlo a ojo

Quise usar `client.messages.count_tokens()` para el análisis económico del
README, para tener un número exacto en vez de una aproximación. Por el mismo
problema de la iteración 1 (sin `ANTHROPIC_API_KEY` en este entorno), esa
llamada tampoco es viable acá. En vez de inventar una cifra con apariencia
de precisión, medí caracteres reales de los archivos de la corrida 1
(prompt del sistema, definición de herramienta, prompt de usuario armado,
bloque de `tool_use`, resultado de la herramienta y salida final) y los
convertí con la heurística de ~4 caracteres por token, dejando explícito en
el README que es una aproximación y no una factura real. Es menos preciso
que lo que hubiera querido, pero es más honesto que redondear una cifra que
no pude verificar.

---

## Iteración 5 — De "modo asistido" a ejecución automática real, con Gemini

**Fecha**: 2026-09-01, después de la primera corrección de este trabajo.

El agente evaluador de la materia calificó la primera versión de esta
entrega con 80.5/100, marcando exactamente el punto débil que ya estaba
documentado en la iteración 1: la llamada a la herramienta era real, pero el
paso de razonamiento del LLM se había generado en "modo asistido" por falta
de `ANTHROPIC_API_KEY`. La corrección sugería conseguir una key de bajo
límite de gasto y correr `triage_agent.py` una vez de verdad.

Lo intenté y choqué con un bloqueo nuevo, no documentado antes: la cuenta de
Anthropic disponible tiene la creación de API keys **bloqueada por política
de la organización** (una restricción de cuenta de trabajo, no del entorno
de pruebas). Antes de resignarme a dejarlo como estaba, evalué una
alternativa: **Google AI Studio** da una API key de Gemini gratis con solo
una cuenta de Google personal, sin ese tipo de bloqueo corporativo.

Antes de tocar `triage_agent.py`, validé la key y la mecánica completa a
mano, con `curl` contra la API real de Gemini — no fue "cambiar un nombre de
modelo y listo". Encontré dos errores reales en el camino:

1. **Modelo dado de baja.** El primer intento contra `gemini-2.0-flash`
   devolvió `404`: *"This model models/gemini-2.0-flash is no longer
   available... use models/gemini-3.6-flash"*. Reintenté con
   `gemini-3.6-flash` y funcionó.
2. **Rol inválido en la respuesta de la herramienta.** Armé el turno de
   `functionResponse` con `role: "function"` (la convención que recordaba de
   la documentación de Gemini) y la API lo rechazó con `400
   INVALID_ARGUMENT`: *"Role 'function' is not supported. Please use a valid
   role: SYSTEM, ..., MODEL, USER."* La corrección fue mandar ese turno con
   `role: "user"`, como cualquier otro turno del lado del cliente.

Con la mecánica ya probada a mano (tool-calling real + salida forzada por
`responseSchema`, contra la misma alerta y el mismo mock de monitoreo de
siempre), agregué `ejecutar_corrida_gemini()` a `triage_agent.py` como un
segundo proveedor (`--proveedor gemini`), sin tocar la ruta de Anthropic ni
el contrato. Corrí las tres corridas de punta a punta, de verdad, contra la
API de Gemini, y sobreescribí `output_crudo.json` / `metadata.json` de las
tres carpetas de `corridas/` con la salida real (`modo_generacion:
"automatico"`, con `usage_por_llamada` tomado literal de la respuesta de la
API, no estimado).

**Lo que cambió al pasar de razonamiento manual a automático — documentado,
no prolijado:**

- **Corrida 1 (P1, checkout-api)**: el resultado automático coincide en
  sustancia con el borrador manual (severidad, causa probable, rollback
  recomendado). Buena señal de que el contrato es suficientemente explícito
  como para que dos "razonadores" distintos converjan.
- **Corrida 2 (P3, payments-db)**: acá sí hay una diferencia real. Yo había
  puesto `sistemas_afectados: ["payments-db"]` a mano, limitándome al
  servicio de la alerta. El modelo automático devolvió
  `["checkout-api", "billing-service"]`, tomando esos nombres del campo
  `descripcion` de la respuesta de la herramienta ("instancia... compartida
  por checkout-api y billing-service"). No viola la letra del contrato (son
  datos que sí vinieron de la herramienta, no inventados), pero es una
  lectura más amplia de "sistemas afectados" que la que yo había hecho —
  vale la pena revisar si la pieza 2 del contrato debería aclarar si
  "afectados" incluye dependientes mencionados en la descripción o solo el
  servicio de la alerta. Quedó así, sin corregir, como evidencia real de
  ambigüedad de contrato, no como error a esconder.
- **Corrida 3 (servicio no encontrado)**: como se detalla en la iteración 3
  arriba, la severidad automática fue `P1` en vez del `P2` que yo había
  elegido a mano — la misma ambigüedad de schema, resuelta distinto por dos
  lectores distintos del mismo contrato.

**Por qué el análisis económico del README sigue hablando de Claude Haiku
4.5 y no de Gemini**: el contrato y la justificación de modelo (§ Análisis
económico) están pensados y costeados para Claude, que es el proveedor que
elegiría en producción — Gemini fue la vía de acceso disponible para validar
el pipeline en este entorno puntual, no un cambio de la decisión de diseño.
Dejarlo mezclado sin esta aclaración sería más confuso que el problema que
vino a resolver.

---

## Iteración 6 — Revisión de código externa: 5 hallazgos reales, 5 corregidos

**Fecha**: 2026-09-01, tras la corrección con rúbrica v4 (92.5/100, sin
cambio en la nota — la revisión de código es informativa, no puntúa).

El agente evaluador leyó `triage_agent.py` y `monitoring_api_mock.py`
completos y encontró cinco problemas concretos, con línea exacta. Los
reviso uno por uno porque tres son bugs reales (no solo estilo) que
`triage_agent.py --proveedor gemini` ya había ejercitado en las tres
corridas de evidencia sin que ninguno se disparara — es decir, existían y
no los había visto, y confirmar eso es tan importante como corregirlos.

1. **API key de Gemini en la URL (`?key=...`) en vez de en un header.**
   Cierto: un proxy o un log de acceso HTTP guarda la query string en texto
   plano con mucha más frecuencia que los headers. Corregido: la key ahora
   va en el header `x-goog-api-key`, no en la URL. Antes de aplicar el
   cambio lo validé a mano con `curl` contra la API real (mismo patrón que
   en la iteración 5: no asumir que la corrección funciona, probarla) — la
   API acepta el header igual que el query param, así que el fix no rompe
   nada.
2. **`next(...)` sin valor por defecto** en el bloque que extrae el texto
   final de la respuesta (tanto en la ruta de Gemini, que fue la que
   reportaron, como en la de Anthropic, que tiene el mismo patrón y no
   había sido señalada). Si el modelo termina el turno sin ningún bloque de
   texto, esto tira `StopIteration` — un error real pero sin ningún
   contexto de qué pasó. Corregido en las dos rutas: ahora uso `next(...,
   None)` y, si da `None`, levanto un `RuntimeError` con el `content`
   completo de la respuesta adentro del mensaje.
3. **Los dos loops de tool-calling (`while True:`) sin tope de
   iteraciones.** Si el modelo entrara en un loop pidiendo la herramienta
   sin parar, el script quedaría facturando llamadas indefinidamente.
   Agregué `MAX_RONDAS_HERRAMIENTA = 5` y convertí ambos `while True` en
   `for ronda in range(...)`, que corta con un `RuntimeError` legible si se
   supera el tope.
4. **Argumentos alucinados del modelo pasados directo a
   `consultar_api_monitoreo(**args)`.** Un parámetro de más o de tipo
   incorrecto revienta con `TypeError` sin contexto. Agregué
   `invocar_herramienta()`, un envoltorio compartido por las dos rutas que
   atrapa el `TypeError` y lo convierte en un resultado de error con la
   misma forma `{"status": 400, "body": {...}}` que ya usa el resto del
   sistema — así el contrato lo trata igual que cualquier otro
   `error_herramienta`, en vez de que el proceso completo se caiga.
5. **El mock declara `ventana_minutos` entre 5 y 180 en `TOOL_DEF` pero no
   lo hace cumplir.** Correcto: el mock aceptaba cualquier valor. Agregué
   la validación de rango en `monitoring_api_mock.py` (`400
   ventana_minutos_fuera_de_rango` fuera de `[5, 180]`), probada con `curl`
   contra los dos bordes (2 y 250) antes de darla por buena.

Después de los cinco fixes corrí de nuevo una corrida real completa contra
Gemini (`corrida_02`, con la validación de rango ya activa) para confirmar
que nada se rompió — el resultado fue consistente con la corrida anterior.
También agregué `agente/correr_corrida.sh`: un wrapper que levanta el mock,
corre el agente, y apaga el mock solo (incluso si el agente falla), para
que reproducir una corrida sea un solo comando en vez de dos procesos
coordinados a mano en dos terminales.

---

## Iteración 7 — Checklist v5: caso peor con rango en el análisis económico

**Fecha**: 2026-09-01, tras la corrección con checklist v5 (94.0/100).

El corrector reemplazó la rúbrica por checklists itemizados y, aplicados en
serio, dos dimensiones se movieron: Sistema subió (un criterio que se le
exigía de más no estaba en `rubrica.md`) y Económico bajó de 9 a 8 porque
el checklist de 9-10 pide explícitamente "caso peor + rango", y el README
solo daba un número puntual por escala de volumen.

Lo resolví con datos que ya tenía, no con una suposición nueva: `usage_por_llamada`
de las tres corridas reales de Gemini (iteración 5) ya registra, sin que lo
hubiera usado hasta ahora, cuánto crece el tamaño del prompt entre la ronda
1 y la ronda 2 de cada corrida — 721 tokens en corrida_01, 607 en
corrida_02, 223 en corrida_03 (la de menor crecimiento porque el resultado
de la herramienta fue un error 404 corto, no un historial completo).

El caso peor real del sistema no es una suposición sobre reintentos de red:
es `MAX_RONDAS_HERRAMIENTA = 5`, el tope de código que agregué en la
iteración 6 para la Fase 5 de revisión. Usando el crecimiento por ronda más
grande medido (721 tokens / 1.345 caracteres, corrida_01) como driver,
calculé qué costaría una corrida que agotara ese tope: ~$0.022 contra los
~$0.007 del caso feliz — un rango de USD 0.007–0.022 por corrida, que
después escalé a rangos semanales y anuales en la tabla de proyección de
costos del README. El techo de esa tabla (ej. ~$169/año con Haiku a 150
alertas/semana, incluso si *cada* corrida agotara el tope de reintentos) es
el número que le importa a quien aprueba presupuesto — un límite calculable,
no una sorpresa de facturación.

**Lo que quedó pendiente, sin resolver acá**: el checklist de Gobierno
(10→8) pide evidencia de que el control humano se ejecutó — un registro de
una decisión real de una persona sobre un triage — no solo que el agente
proponga correctamente cuándo hace falta un humano. Documento esa parte por
separado (ver iteración 8, si llega a existir) porque no se puede resolver
con datos que ya tenía: hay que generar la evidencia de verdad, y fabricarla
sería exactamente el tipo de fraude que este trabajo está diseñado para
detectar.

---

## Cambios de alcance — resumen

| Qué se achicó | Por qué |
|---|---|
| API de monitoreo productiva (Datadog/Grafana) → stand-in local con el mismo contrato HTTP | Sin credenciales de una cuenta real de monitoreo para esta entrega (iteración 1). |
| Pipeline automático con Claude (el proveedor documentado en el análisis económico) → validación end-to-end real con Gemini 3.6 Flash como segundo proveedor | La cuenta de Anthropic disponible tiene bloqueada la creación de API keys por política de la organización; Gemini fue la vía de acceso real disponible (iteración 5). El código para Anthropic queda completo y sin cambios, listo para correr con una key válida. |
| Variante de user prompt para resumen de turno en lote | No implementada; el schema de salida no la soporta sin duplicar validación (iteración 2). |
| Quinto valor de severidad para "no determinable" | No implementado; mitigado con `confianza` baja + `nivel_autonomia: L1` — y confirmado como ambigüedad real, no teórica, al ver que la versión manual y la automática lo resolvieron distinto (iteraciones 3 y 5). |
| Costo por corrida exacto vía `count_tokens()` | No disponible sin API key de Anthropic; reemplazado por estimación transparente basada en caracteres reales (iteración 4). El costo real de Gemini de la iteración 5 sí quedó registrado en `usage_por_llamada` de cada `metadata.json`, pero no se usó para el análisis económico porque ese está costeado en base al proveedor elegido (Claude). |
