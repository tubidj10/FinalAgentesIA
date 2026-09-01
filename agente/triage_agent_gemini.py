"""Agente de Triage de Infraestructura — variante con Gemini.

Mismo contrato (prompts/system_prompt.md + prompts/user_prompt.md), misma
herramienta real (consultar_api_monitoreo, HTTP real contra
agente/monitoring_api_mock.py) y mismo schema de salida que
agente/triage_agent.py — pero llamando a la API de Gemini en vez de a la de
Anthropic.

Por qué existe este archivo en vez de modificar triage_agent.py: el contrato
fue diseñado y su análisis económico (README, § Análisis económico) está
calculado en términos de modelos Claude. No conseguimos una
ANTHROPIC_API_KEY a tiempo para la entrega, pero sí una GEMINI_API_KEY — en
vez de mentir sobre qué modelo corrió, se documenta acá como lo que es: un
sustituto real, no el modelo del contrato. Ver DECISIONES.md, iteración 5.

Uso:
    python3 monitoring_api_mock.py &
    export GEMINI_API_KEY=...
    python3 triage_agent_gemini.py corridas/corrida_01_.../input.json corridas/corrida_01_.../
"""

import json
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from triage_agent import (
    OUTPUT_SCHEMA,
    TOOL_DEF,
    cargar_system_prompt,
    construir_user_prompt,
    consultar_api_monitoreo,
)

GEMINI_MODEL = "gemini-3.6-flash"
GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"


def _schema_a_gemini(schema):
    """Convierte un JSON Schema (con `type: [X, "null"]`) al subset que acepta
    Gemini (`type: X, nullable: true`), y descarta claves no soportadas
    (`additionalProperties`)."""
    if isinstance(schema, dict):
        salida = {}
        for clave, valor in schema.items():
            if clave == "additionalProperties":
                continue
            if clave == "type" and isinstance(valor, list):
                no_nulos = [t for t in valor if t != "null"]
                salida["type"] = no_nulos[0] if no_nulos else "string"
                if "null" in valor:
                    salida["nullable"] = True
                continue
            salida[clave] = _schema_a_gemini(valor)
        return salida
    if isinstance(schema, list):
        return [_schema_a_gemini(v) for v in schema]
    return schema


def _gemini_generate(api_key: str, contents: list, system_prompt: str, *, tools=None, response_schema=None) -> dict:
    url = f"{GEMINI_API_BASE}/models/{GEMINI_MODEL}:generateContent"
    body = {
        "system_instruction": {"parts": [{"text": system_prompt}]},
        "contents": contents,
    }
    if tools:
        body["tools"] = [{"function_declarations": tools}]
    gen_config = {}
    if response_schema:
        gen_config["responseMimeType"] = "application/json"
        gen_config["responseSchema"] = response_schema
    if gen_config:
        body["generationConfig"] = gen_config

    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detalle = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Gemini API error {e.code}: {detalle}") from e


def ejecutar_corrida_gemini(alerta: dict, log_dir: Path, api_key: str) -> dict:
    log_dir.mkdir(parents=True, exist_ok=True)
    system_prompt = cargar_system_prompt()
    user_prompt = construir_user_prompt(alerta)
    fecha_inicio = datetime.now(timezone.utc).isoformat()

    (log_dir / "input.json").write_text(
        json.dumps(alerta, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (log_dir / "user_prompt_enviado.txt").write_text(user_prompt, encoding="utf-8")

    contents = [{"role": "user", "parts": [{"text": user_prompt}]}]
    gemini_tool = {
        "name": TOOL_DEF["name"],
        "description": TOOL_DEF["description"],
        "parameters": _schema_a_gemini(TOOL_DEF["input_schema"]),
    }
    llamadas_a_herramienta = []
    respuestas_crudas = []

    while True:
        resultado_api = _gemini_generate(api_key, contents, system_prompt, tools=[gemini_tool])
        respuestas_crudas.append(resultado_api)
        candidato = resultado_api["candidates"][0]
        if "content" not in candidato:
            raise RuntimeError(f"Gemini no devolvió contenido (finishReason={candidato.get('finishReason')})")
        partes = candidato["content"]["parts"]
        llamadas_funcion = [p["functionCall"] for p in partes if "functionCall" in p]

        if not llamadas_funcion:
            break

        contents.append({"role": "model", "parts": partes})
        respuestas_funcion = []
        for fc in llamadas_funcion:
            resultado = consultar_api_monitoreo(**fc["args"])
            llamadas_a_herramienta.append({"input": fc["args"], "resultado": resultado})
            respuestas_funcion.append(
                {"functionResponse": {"name": fc["name"], "response": resultado["body"]}}
            )
        contents.append({"role": "user", "parts": respuestas_funcion})

    # Llamada final: sin tools, con el schema de salida forzado -- garantiza
    # JSON estricto aunque la última respuesta del loop de arriba no lo fuera.
    contents.append(
        {
            "role": "user",
            "parts": [
                {
                    "text": "Emití ahora tu triage final, únicamente como el JSON "
                    "del formato de salida definido en la pieza 5 del contrato."
                }
            ],
        }
    )
    schema_gemini = _schema_a_gemini(OUTPUT_SCHEMA["schema"])
    resultado_final = _gemini_generate(
        api_key, contents, system_prompt, response_schema=schema_gemini
    )
    respuestas_crudas.append(resultado_final)
    texto_final = resultado_final["candidates"][0]["content"]["parts"][0]["text"]

    fecha_fin = datetime.now(timezone.utc).isoformat()

    (log_dir / "llamadas_herramienta.json").write_text(
        json.dumps(llamadas_a_herramienta, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (log_dir / "output_crudo.json").write_text(texto_final, encoding="utf-8")

    usage_total = {"promptTokenCount": 0, "candidatesTokenCount": 0, "totalTokenCount": 0}
    for r in respuestas_crudas:
        um = r.get("usageMetadata", {})
        for clave in usage_total:
            usage_total[clave] += um.get(clave, 0)

    (log_dir / "metadata.json").write_text(
        json.dumps(
            {
                "proveedor": "google_gemini",
                "modelo": GEMINI_MODEL,
                "modo_generacion": "real_api_gemini",
                "modo_generacion_detalle": (
                    "Corrida real de punta a punta contra la API de Gemini, usada como "
                    "sustituto documentado de la API de Anthropic (el contrato y su "
                    "analisis economico estan pensados para Claude -- ver README, "
                    "seccion Analisis economico -- pero no se consiguio una "
                    "ANTHROPIC_API_KEY a tiempo). Reemplaza el modo 'asistido_claude_code' "
                    "anterior por una llamada real y facturada a un LLM: misma herramienta "
                    "real (consultar_api_monitoreo), mismo contrato, mismo schema de salida "
                    "forzado, distinto proveedor. Ver DECISIONES.md, iteracion 5."
                ),
                "fecha_inicio_utc": fecha_inicio,
                "fecha_fin_utc": fecha_fin,
                "cantidad_llamadas_herramienta": len(llamadas_a_herramienta),
                "cantidad_llamadas_api_gemini": len(respuestas_crudas),
                "usage_total_tokens": usage_total,
                "reconstruible_con": [
                    "1. Levantar la API mock: python3 agente/monitoring_api_mock.py 8765",
                    "2. Con GEMINI_API_KEY seteada: python3 agente/triage_agent_gemini.py <input.json> <directorio_corrida>/",
                ],
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    return json.loads(texto_final)


if __name__ == "__main__":
    import os

    if len(sys.argv) != 3:
        print("Uso: python3 triage_agent_gemini.py <input.json> <directorio_corrida>")
        sys.exit(1)

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("ERROR: falta GEMINI_API_KEY (falla cerrado, a propósito -- ver DECISIONES.md, iteración 1).", file=sys.stderr)
        sys.exit(2)

    alerta_path = Path(sys.argv[1])
    log_dir = Path(sys.argv[2])
    alerta = json.loads(alerta_path.read_text(encoding="utf-8"))

    salida = ejecutar_corrida_gemini(alerta, log_dir, api_key)
    print(json.dumps(salida, ensure_ascii=False, indent=2))
