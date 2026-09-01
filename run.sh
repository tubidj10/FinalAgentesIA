#!/usr/bin/env bash
# ==============================================================================
# Script de Ejecución en Un Solo Paso (One-Step Runner)
# Proyecto: Agente de Triage de Infraestructura (MBA UCEMA)
# ==============================================================================
# Este script ejecuta todo el ciclo en un solo paso:
# 1. Levanta la API local de monitoreo HTTP (GET /api/v1/monitoreo/historial)
# 2. Ejecuta el agente agéntico con tool calling contra la corrida especificada
# 3. Valida el output JSON Schema
# 4. Apaga el servidor de métricas automáticamente al finalizar
#
# Uso:
#   ./run.sh [1|2|3] [anthropic|gemini]
#   ./run.sh 1 gemini
#   ./run.sh 2 gemini
#   ./run.sh 3 gemini
# ==============================================================================

set -euo pipefail

CORRIDA_NUM="${1:-1}"
PROVEEDOR="${2:-gemini}"

case "$CORRIDA_NUM" in
  1)
    INPUT_PATH="corridas/corrida_01_p1_checkout_api/input.json"
    OUTPUT_DIR="/tmp/salida_corrida_01"
    ;;
  2)
    INPUT_PATH="corridas/corrida_02_p3_payments_db_ruido/input.json"
    OUTPUT_DIR="/tmp/salida_corrida_02"
    ;;
  3)
    INPUT_PATH="corridas/corrida_03_p2_servicio_no_encontrado/input.json"
    OUTPUT_DIR="/tmp/salida_corrida_03"
    ;;
  *)
    INPUT_PATH="$CORRIDA_NUM"
    OUTPUT_DIR="${3:-/tmp/salida_custom}"
    ;;
esac

echo "=========================================================="
echo "🚀 Iniciando Ejecución en 1 Solo Paso — Agente de Triage"
echo "• Entrada:   $INPUT_PATH"
echo "• Salida:    $OUTPUT_DIR"
echo "• Proveedor: $PROVEEDOR"
echo "=========================================================="

mkdir -p "$OUTPUT_DIR"

# Ejecutar el runner agéntico encapsulado
bash agente/correr_corrida.sh "$INPUT_PATH" "$OUTPUT_DIR" "$PROVEEDOR"

echo "=========================================================="
echo "✅ Corrida finalizada con éxito."
echo "Resultados generados en: $OUTPUT_DIR"
echo "=========================================================="
