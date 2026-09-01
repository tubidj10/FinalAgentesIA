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
La corrida 3 tuvo que forzar `P2` como una elección conservadora, aun cuando
lo honesto sería decir "no sé la severidad, sé que no pude confirmar nada".
Lo mitigo bajando `confianza` y forzando revisión humana, pero es un parche,
no una solución de schema. Lo dejé así para esta entrega (cambiar el enum
implica re-validar las otras dos corridas y el schema completo) y lo anoté
como primer ítem de escala futura en el README en vez de resolverlo apurado
a último momento.

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

## Iteración 5 — Corrida real, pero con Gemini en vez de Claude

**Fecha**: 2026-09-01.

Después de cerrar la iteración 1 (sin `ANTHROPIC_API_KEY` en el entorno de
pruebas), conseguimos una `GEMINI_API_KEY`. Con eso se puede correr el
pipeline de punta a punta contra un LLM real y facturado — pero no contra
el que dice el contrato. Dos caminos posibles: (a) dejar las tres corridas
en modo asistido como estaban, o (b) correrlas de verdad, con un modelo
distinto al declarado, dejándolo explícito.

Elegimos (b). Razón: una corrida real con el modelo "equivocado" pero
documentada como tal es más honesta y más útil como evidencia que una
corrida sin ejecución real de ningún LLM — sigue probando que el contrato
(tool-calling obligatorio, schema de salida estricto, reglas anti-alucinación
de la iteración 3) funciona contra un modelo real, no solo contra el
razonamiento de quien lo escribió. Lo que **no** hicimos: dejar que pareciera
que corrió con Claude. `metadata.json` de cada corrida ahora dice
`"proveedor": "google_gemini"` y `"modelo": "gemini-3.6-flash"` explícitamente,
y el análisis económico del README sigue calculado y declarado en términos de
Claude — no lo recalculamos con precios de Gemini, porque el modelo elegido
para producción sigue siendo Haiku 4.5; esta corrida es una prueba de que el
contrato funciona, no un cambio de arquitectura.

**Tropiezo real nº1 — nombre de modelo desactualizado.** El primer intento
usó `gemini-2.5-flash` (el modelo que conocíamos) y la API respondió `404`:
*"This model models/gemini-2.5-flash is no longer available to new users.
Please update your code to use models/gemini-3.6-flash"*. La propia API dio
el nombre vigente; se corrigió antes de generar ninguna corrida.

**Tropiezo real nº2 — el mock de monitoreo se cae entre corridas.** El
servidor de `monitoring_api_mock.py`, levantado en background, se murió
solo entre un intento y el siguiente (killeado por el entorno de ejecución
al cerrarse el proceso padre, no por un bug del propio mock). Primer
síntoma: `ConnectionRefusedError` al llamar a `consultar_api_monitoreo` en
plena corrida. Solución aplicada: verificar con un `curl` corto antes de
cada corrida y relevantar el mock si no responde, en vez de asumir que sigue
vivo de una corrida a la siguiente.

**Tropiezo real nº3 — timeout transitorio de red contra la API de Gemini**
en la corrida de `payments-db` (`TimeoutError` leyendo la respuesta a los 30
segundos). Se reintentó una vez sin cambiar nada más y la segunda corrida
completó normal — se trató como una falla de red transitoria, no como un
bug del contrato o del script, y quedó así documentado en vez de
silenciado.

**Adaptación técnica necesaria**: Gemini no acepta el mismo formato de JSON
Schema que usamos para `OUTPUT_SCHEMA` (no soporta `type: [X, "null"]` para
campos nullable, ni `additionalProperties`). Se escribió un conversor
(`_schema_a_gemini` en `agente/triage_agent_gemini.py`) que traduce el
schema existente al subset que acepta Gemini (`nullable: true` en vez de un
tipo compuesto), en vez de mantener dos schemas por separado — una sola
fuente de verdad (`OUTPUT_SCHEMA` en `triage_agent.py`) para ambos
proveedores.

**Diferencia real de comportamiento entre modelos, documentada sin
esconderla**: en la corrida de `checkout-worker` (servicio no encontrado),
Gemini asignó `severidad: "P1"` con `confianza: 0.4`, mientras que la
versión asistida anterior (con razonamiento de Claude) había elegido
`P2` con `confianza: 0.3`. Ambas cumplen la regla que importa del contrato
(confianza < 0.5 → `nivel_autonomia: "L1"`, no se publica solo, y
`error_herramienta` queda registrado en vez de inventar un historial) — la
diferencia de severidad exacta entre P1 y P2 ante un dato ausente es
exactamente el límite de schema que la iteración 3 ya había dejado marcado
como sin resolver ("no hay un valor para *no determinable*"), y este caso
real con otro modelo lo confirma en vez de ser una casualidad de una sola
corrida.

## Cambios de alcance — resumen

| Qué se achicó | Por qué |
|---|---|
| API de monitoreo productiva (Datadog/Grafana) → stand-in local con el mismo contrato HTTP | Sin credenciales de una cuenta real de monitoreo para esta entrega (iteración 1). |
| Pipeline 100% automático de punta a punta con Claude → corrida real de punta a punta, pero con Gemini como sustituto | Sin `ANTHROPIC_API_KEY` en el entorno de pruebas, sí con `GEMINI_API_KEY`; el script de producción (`triage_agent.py`, Claude) queda completo y listo para correr sin supervisión con una clave válida (iteración 1); `triage_agent_gemini.py` documenta y ejecuta el sustituto real (iteración 5). |
| Variante de user prompt para resumen de turno en lote | No implementada; el schema de salida no la soporta sin duplicar validación (iteración 2). |
| Quinto valor de severidad para "no determinable" | No implementado; mitigado con `confianza` baja + `nivel_autonomia: L1` (iteración 3). |
| Costo por corrida exacto vía `count_tokens()` | No disponible sin API key; reemplazado por estimación transparente basada en caracteres reales (iteración 4). |
