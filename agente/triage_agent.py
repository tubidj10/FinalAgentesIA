"""Agente de Triage de Infraestructura.

Ejecuta el contrato de prompts/system_prompt.md + prompts/user_prompt.md
contra una alerta real, usando la herramienta consultar_api_monitoreo (HTTP
real contra agente/monitoring_api_mock.py) y guarda evidencia cruda
(request, llamadas a herramienta, respuesta final) en corridas/<nombre>/.

Requiere ANTHROPIC_API_KEY en el entorno para el paso de razonamiento del
modelo (ver DECISIONES.md, iteracion 1, sobre por que ese paso se ejecuto de
forma asistida en el entorno de pruebas de esta entrega en vez de vía este
script sin supervisión).

Uso:
    python3 monitoring_api_mock.py &
    python3 triage_agent.py corridas/corrida_01_.../input.json corridas/corrida_01_.../
"""

import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

MODEL = "claude-haiku-4-5"
MAX_TOKENS = 1024
MONITORING_API_BASE = "http://127.0.0.1:8765"
PROMPTS_DIR = Path(__file__).parent.parent / "prompts"

TOOL_DEF = {
    "name": "consultar_api_monitoreo",
    "description": (
        "Consulta el historial reciente de metricas (tasa de error, latencia p95, "
        "CPU) y los incidentes/deploys recientes de un servicio."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "servicio": {
                "type": "string",
                "description": "Nombre exacto del servicio, tal como aparece en la alerta (campo 'servicio').",
            },
            "ventana_minutos": {
                "type": "integer",
                "description": "Minutos hacia atras a consultar. Default 30.",
                "minimum": 5,
                "maximum": 180,
            },
        },
        "required": ["servicio"],
    },
}

OUTPUT_SCHEMA = {
    "type": "json_schema",
    "schema": {
        "type": "object",
        "properties": {
            "alerta_id": {"type": "string"},
            "servicio": {"type": "string"},
            "severidad": {"type": "string", "enum": ["P1", "P2", "P3", "P4"]},
            "confianza": {"type": "number", "minimum": 0, "maximum": 1},
            "causa_probable": {"type": "string"},
            "sistemas_afectados": {"type": "array", "items": {"type": "string"}},
            "evidencia": {
                "type": "object",
                "properties": {
                    "metrica_actual": {"type": "string"},
                    "comparacion_historica": {"type": "string"},
                    "incidente_correlacionado": {"type": ["string", "null"]},
                    "error_herramienta": {"type": ["string", "null"]},
                },
                "required": [
                    "metrica_actual",
                    "comparacion_historica",
                    "incidente_correlacionado",
                    "error_herramienta",
                ],
                "additionalProperties": False,
            },
            "accion_recomendada": {"type": "string"},
            "requiere_intervencion_humana": {"type": "boolean"},
            "nivel_autonomia": {"type": "string", "enum": ["L0", "L1", "L2", "L3", "L4"]},
            "siguiente_paso": {"type": "string"},
        },
        "required": [
            "alerta_id",
            "servicio",
            "severidad",
            "confianza",
            "causa_probable",
            "sistemas_afectados",
            "evidencia",
            "accion_recomendada",
            "requiere_intervencion_humana",
            "nivel_autonomia",
            "siguiente_paso",
        ],
        "additionalProperties": False,
    },
}


def cargar_system_prompt() -> str:
    return (PROMPTS_DIR / "system_prompt.md").read_text(encoding="utf-8")


def construir_user_prompt(alerta: dict) -> str:
    plantilla = (
        "Llegó la siguiente alerta de producción. Triageala siguiendo el "
        "contrato del system prompt.\n\nAlerta:\n{alerta_json}\n\nRecordá: "
        "tenés que consultar la API de monitoreo para el servicio de la "
        "alerta antes de responder, y tu respuesta final tiene que ser "
        "únicamente el JSON del formato de salida definido en la pieza 5 "
        "del contrato."
    )
    return plantilla.format(alerta_json=json.dumps(alerta, ensure_ascii=False, indent=2))


def consultar_api_monitoreo(servicio: str, ventana_minutos: int = 30) -> dict:
    """Llamada HTTP real (no simulada) contra el stand-in local de la API de monitoreo."""
    url = (
        f"{MONITORING_API_BASE}/api/v1/monitoreo/historial"
        f"?servicio={urllib.parse.quote(servicio)}&ventana_minutos={ventana_minutos}"
    )
    try:
        with urllib.request.urlopen(url, timeout=5) as resp:
            return {"status": resp.status, "body": json.loads(resp.read().decode("utf-8"))}
    except urllib.error.HTTPError as e:
        return {"status": e.code, "body": json.loads(e.read().decode("utf-8"))}


def ejecutar_corrida(alerta: dict, log_dir: Path) -> dict:
    """Corre el loop agentico completo y deja evidencia cruda en log_dir."""
    log_dir.mkdir(parents=True, exist_ok=True)
    import anthropic  # importado acá, no al tope del módulo: así triage_agent_gemini.py
    # puede reusar TOOL_DEF/OUTPUT_SCHEMA/cargar_system_prompt/etc. de este archivo
    # sin necesitar el paquete `anthropic` instalado.
    client = anthropic.Anthropic()

    system_prompt = cargar_system_prompt()
    user_prompt = construir_user_prompt(alerta)
    fecha_inicio = datetime.now(timezone.utc).isoformat()

    (log_dir / "input.json").write_text(
        json.dumps(alerta, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (log_dir / "user_prompt_enviado.txt").write_text(user_prompt, encoding="utf-8")

    messages = [{"role": "user", "content": user_prompt}]
    llamadas_a_herramienta = []

    while True:
        response = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=system_prompt,
            tools=[TOOL_DEF],
            output_config={"format": OUTPUT_SCHEMA},
            messages=messages,
        )

        if response.stop_reason == "tool_use":
            messages.append({"role": "assistant", "content": response.content})
            tool_results = []
            for block in response.content:
                if block.type != "tool_use":
                    continue
                resultado = consultar_api_monitoreo(**block.input)
                llamadas_a_herramienta.append(
                    {"input": block.input, "resultado": resultado}
                )
                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": json.dumps(resultado["body"], ensure_ascii=False),
                        "is_error": resultado["status"] >= 400,
                    }
                )
            messages.append({"role": "user", "content": tool_results})
            continue

        break

    fecha_fin = datetime.now(timezone.utc).isoformat()
    texto_final = next(b.text for b in response.content if b.type == "text")

    (log_dir / "llamadas_herramienta.json").write_text(
        json.dumps(llamadas_a_herramienta, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (log_dir / "output_crudo.json").write_text(texto_final, encoding="utf-8")
    (log_dir / "metadata.json").write_text(
        json.dumps(
            {
                "modelo": MODEL,
                "fecha_inicio_utc": fecha_inicio,
                "fecha_fin_utc": fecha_fin,
                "stop_reason": response.stop_reason,
                "usage": response.usage.to_dict() if response.usage else None,
                "cantidad_llamadas_herramienta": len(llamadas_a_herramienta),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    return json.loads(texto_final)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Uso: python3 triage_agent.py <input.json> <directorio_corrida>")
        sys.exit(1)

    alerta_path = Path(sys.argv[1])
    log_dir = Path(sys.argv[2])
    alerta = json.loads(alerta_path.read_text(encoding="utf-8"))

    salida = ejecutar_corrida(alerta, log_dir)
    print(json.dumps(salida, ensure_ascii=False, indent=2))
