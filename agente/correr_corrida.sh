#!/usr/bin/env bash
# Reproduce una corrida completa en un solo comando: levanta la API de
# monitoreo real, corre el agente, y apaga la API al terminar (incluso si
# el agente falla). Antes había que levantar el mock a mano en background
# en una terminal y correr triage_agent.py en otra — esto lo deja en un
# solo paso para que un tercero (humano o agente evaluador) lo reproduzca
# sin tener que orquestar procesos.
#
# Uso:
#   ./correr_corrida.sh <input.json> <directorio_salida> [proveedor]
#   ./correr_corrida.sh ../corridas/corrida_01_p1_checkout_api/input.json /tmp/salida_01 gemini
#
# Requiere ANTHROPIC_API_KEY (proveedor "anthropic", default) o
# GEMINI_API_KEY (proveedor "gemini") ya seteada en el entorno.

set -euo pipefail
cd "$(dirname "$0")"

if [[ $# -lt 2 ]]; then
    echo "Uso: $0 <input.json> <directorio_salida> [anthropic|gemini]" >&2
    exit 1
fi

INPUT_JSON="$1"
DIR_SALIDA="$2"
PROVEEDOR="${3:-anthropic}"
PUERTO=8765

python3 monitoring_api_mock.py "$PUERTO" &
MOCK_PID=$!
trap 'kill "$MOCK_PID" 2>/dev/null || true' EXIT

# Esperar a que el mock responda antes de arrancar, en vez de un sleep fijo.
for _ in $(seq 1 20); do
    if curl -s -o /dev/null "http://127.0.0.1:${PUERTO}/api/v1/monitoreo/historial?servicio=x"; then
        break
    fi
    sleep 0.25
done

python3 triage_agent.py "$INPUT_JSON" "$DIR_SALIDA" --proveedor "$PROVEEDOR"
