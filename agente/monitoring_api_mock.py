"""API de monitoreo (stand-in local) para el Agente de Triage de Infraestructura.

Expone el mismo contrato HTTP que usaria un conector real contra Datadog/Grafana/
Prometheus: GET /api/v1/monitoreo/historial?servicio=X&ventana_minutos=Y.
No hay credenciales de una cuenta productiva de monitoreo en este entorno de
pruebas, asi que este servidor sirve datos de referencia guardados en
fixtures/monitoreo_datos.json (ver DECISIONES.md, iteracion 1). El agente le
hace pedidos HTTP reales via la herramienta `consultar_api_monitoreo`; nada de
esto esta simulado dentro del propio agente.

Uso:
    python3 monitoring_api_mock.py [puerto]   # default 8765
"""

import json
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs

FIXTURES_PATH = Path(__file__).parent / "fixtures" / "monitoreo_datos.json"

# Mismo rango que TOOL_DEF.input_schema.ventana_minutos en triage_agent.py:
# el mock tiene que hacer cumplir el contrato que el resto del sistema
# declara, no solo documentarlo.
VENTANA_MINUTOS_MIN = 5
VENTANA_MINUTOS_MAX = 180


def cargar_datos():
    with open(FIXTURES_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


class MonitoreoHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stderr.write("[monitoring_api_mock] " + (fmt % args) + "\n")

    def _responder(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path != "/api/v1/monitoreo/historial":
            self._responder(404, {"error": "endpoint_no_encontrado", "path": parsed.path})
            return

        qs = parse_qs(parsed.query)
        servicio = qs.get("servicio", [None])[0]
        try:
            ventana_minutos = int(qs.get("ventana_minutos", ["30"])[0])
        except ValueError:
            self._responder(400, {"error": "ventana_minutos_invalida"})
            return

        if not (VENTANA_MINUTOS_MIN <= ventana_minutos <= VENTANA_MINUTOS_MAX):
            self._responder(
                400,
                {
                    "error": "ventana_minutos_fuera_de_rango",
                    "recibido": ventana_minutos,
                    "minimo": VENTANA_MINUTOS_MIN,
                    "maximo": VENTANA_MINUTOS_MAX,
                },
            )
            return

        if not servicio:
            self._responder(400, {"error": "falta_parametro_servicio"})
            return

        datos = cargar_datos()
        info = datos["servicios"].get(servicio)
        if info is None:
            self._responder(
                404,
                {
                    "error": "servicio_no_encontrado",
                    "servicio": servicio,
                    "servicios_disponibles": sorted(datos["servicios"].keys()),
                },
            )
            return

        historial = [
            p for p in info["historial_metricas"] if p["minutos_atras"] <= ventana_minutos
        ]
        incidentes = [
            i for i in info.get("incidentes_recientes", []) if i["minutos_atras"] <= ventana_minutos
        ]

        self._responder(
            200,
            {
                "servicio": servicio,
                "ventana_minutos": ventana_minutos,
                "descripcion": info.get("descripcion", ""),
                "historial_metricas": historial,
                "incidentes_recientes": incidentes,
                "nota_historica": info.get("nota_historica"),
            },
        )


def main():
    puerto = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    server = HTTPServer(("127.0.0.1", puerto), MonitoreoHandler)
    print(f"[monitoring_api_mock] escuchando en http://127.0.0.1:{puerto}")
    server.serve_forever()


if __name__ == "__main__":
    main()
