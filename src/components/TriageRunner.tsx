import React, { useState } from "react";
import {
  Play,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ShieldCheck,
  Cpu,
  ArrowRight,
  Database,
  RotateCcw,
  Sparkles,
  UserCheck,
  Clock,
  Terminal,
  Code2,
  HelpCircle,
  Copy,
  Check
} from "lucide-react";
import { AlertaInput, TriageOutput, LlamadaHerramienta, TriageExecutionLog } from "../types";
import { HitlSignoffModal } from "./HitlSignoffModal";

const PRESET_ALERTAS: { id: string; titulo: string; badge: string; badgeColor: string; data: AlertaInput }[] = [
  {
    id: "preset-1",
    titulo: "Corrida 1: Checkout API (P1 - Post-Deploy)",
    badge: "P1 Crítico",
    badgeColor: "bg-red-500/20 text-red-300 border-red-500/30",
    data: {
      alerta_id: "ALERT-20260901-0091",
      servicio: "checkout-api",
      metrica: "tasa_error_pct",
      valor_actual: 17.8,
      umbral: 5.0,
      timestamp: "2026-09-01T14:32:00Z"
    }
  },
  {
    id: "preset-2",
    titulo: "Corrida 2: Payments DB (P3 - Ruido Cíclico)",
    badge: "P3 Ruido/Mantenimiento",
    badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    data: {
      alerta_id: "ALERT-20260901-0093",
      servicio: "payments-db",
      metrica: "cpu_pct",
      valor_actual: 84.0,
      umbral: 75.0,
      timestamp: "2026-09-01T15:10:00Z"
    }
  },
  {
    id: "preset-3",
    titulo: "Corrida 3: Checkout Worker (P1/L1 - 404 Tool Error)",
    badge: "Tool Error 404",
    badgeColor: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    data: {
      alerta_id: "ALERT-20260901-0097",
      servicio: "checkout-worker",
      metrica: "tasa_error_pct",
      valor_actual: 22.0,
      umbral: 5.0,
      timestamp: "2026-09-01T15:40:00Z"
    }
  }
];

export const TriageRunner: React.FC = () => {
  const [selectedPreset, setSelectedPreset] = useState<string>("preset-1");
  const [alerta, setAlerta] = useState<AlertaInput>(PRESET_ALERTAS[0].data);
  const [isRunning, setIsRunning] = useState(false);
  const [triageResult, setTriageResult] = useState<TriageOutput | null>(null);
  const [llamadas, setLlamadas] = useState<LlamadaHerramienta[]>([]);
  const [logs, setLogs] = useState<TriageExecutionLog[]>([]);
  const [isHitlModalOpen, setIsHitlModalOpen] = useState(false);
  const [lastReview, setLastReview] = useState<any>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isCustomMode, setIsCustomMode] = useState(false);

  const handleSelectPreset = (presetId: string) => {
    setSelectedPreset(presetId);
    setIsCustomMode(false);
    const preset = PRESET_ALERTAS.find((p) => p.id === presetId);
    if (preset) {
      setAlerta(preset.data);
      setTriageResult(null);
      setLlamadas([]);
      setLogs([]);
      setLastReview(null);
    }
  };

  const handleEjecutarTriage = async () => {
    setIsRunning(true);
    setTriageResult(null);
    setLlamadas([]);
    setLogs([]);
    setLastReview(null);

    try {
      const res = await fetch("/api/triage/ejecutar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alerta, proveedor: "gemini" })
      });

      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}`);
      }

      const data = await res.json();
      setTriageResult(data.triage);
      setLlamadas(data.llamadas || []);
      setLogs(data.logs || []);
    } catch (err: any) {
      console.error("Error al ejecutar triage:", err);
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date().toISOString(),
          tipo: "info",
          mensaje: `Error en ejecución: ${err.message}`
        }
      ]);
    } finally {
      setIsRunning(false);
    }
  };

  const handleCopyJson = () => {
    if (triageResult) {
      navigator.clipboard.writeText(JSON.stringify(triageResult, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Explainer */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-1 rounded bg-blue-500/20 text-blue-400">
                <Terminal className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-bold text-white">Ejecutor de Triage Agéntico</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              El agente recibe una alerta de monitoreo, invoca la herramienta <code className="text-blue-300">consultar_api_monitoreo</code> por HTTP real, correlaciona métricas y deploys históricos, y emite un triage estructurado bajo la política de supervisión L2.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              id="run-triage-btn"
              onClick={handleEjecutarTriage}
              disabled={isRunning}
              className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg shadow-md shadow-blue-900/30 flex items-center justify-center space-x-2 transition disabled:opacity-50"
            >
              {isRunning ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Razonando y Consultando API...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Ejecutar Triage Agent</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Preset Alert Selection Grid */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PRESET_ALERTAS.map((preset) => {
            const isSelected = selectedPreset === preset.id && !isCustomMode;
            return (
              <div
                key={preset.id}
                onClick={() => handleSelectPreset(preset.id)}
                className={`cursor-pointer rounded-lg p-3 border transition-all text-left ${
                  isSelected
                    ? "bg-blue-950/40 border-blue-500 shadow-sm shadow-blue-500/10"
                    : "bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${preset.badgeColor}`}>
                    {preset.badge}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">{preset.data.servicio}</span>
                </div>
                <h4 className="text-xs font-semibold text-slate-200">{preset.titulo}</h4>
                <div className="mt-2 text-[11px] text-slate-400 font-mono flex items-center justify-between">
                  <span>{preset.data.metrica}: <strong className="text-slate-200">{preset.data.valor_actual}</strong></span>
                  <span>Umbral: {preset.data.umbral}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Alert Details / Configuration Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Alerta de Entrada ({alerta.alerta_id})</span>
          </h3>
          <button
            onClick={() => setIsCustomMode(!isCustomMode)}
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center space-x-1"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>{isCustomMode ? "Usar Valores Fijos" : "Editar Alerta Personalizada"}</span>
          </button>
        </div>

        {isCustomMode ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">ID Alerta</label>
              <input
                type="text"
                value={alerta.alerta_id}
                onChange={(e) => setAlerta({ ...alerta, alerta_id: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Servicio</label>
              <input
                type="text"
                value={alerta.servicio}
                onChange={(e) => setAlerta({ ...alerta, servicio: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Métrica</label>
              <input
                type="text"
                value={alerta.metrica}
                onChange={(e) => setAlerta({ ...alerta, metrica: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Valor Actual</label>
              <input
                type="number"
                step="0.1"
                value={alerta.valor_actual}
                onChange={(e) => setAlerta({ ...alerta, valor_actual: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Umbral</label>
              <input
                type="number"
                step="0.1"
                value={alerta.umbral}
                onChange={(e) => setAlerta({ ...alerta, umbral: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Timestamp</label>
              <input
                type="text"
                value={alerta.timestamp}
                onChange={(e) => setAlerta({ ...alerta, timestamp: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
              />
            </div>
          </div>
        ) : (
          <div className="bg-slate-950/80 rounded-lg p-3.5 border border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-xs">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase tracking-wider">Servicio</span>
              <span className="text-slate-200 font-semibold">{alerta.servicio}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase tracking-wider">Métrica</span>
              <span className="text-slate-200 font-semibold">{alerta.metrica}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase tracking-wider">Valor vs Umbral</span>
              <span className="text-amber-300 font-bold">{alerta.valor_actual}</span>
              <span className="text-slate-500"> / {alerta.umbral}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase tracking-wider">Timestamp UTC</span>
              <span className="text-slate-300">{alerta.timestamp}</span>
            </div>
          </div>
        )}
      </div>

      {/* Execution Pipeline Steps / Logs */}
      {logs.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-300 flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-blue-400" />
              <span>Traza de Ejecución Agéntica & Tool Calling</span>
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">{logs.length} eventos</span>
          </div>

          <div className="bg-slate-950 rounded-lg border border-slate-800 p-3 space-y-2 max-h-48 overflow-y-auto font-mono text-xs">
            {logs.map((log, index) => (
              <div key={index} className="flex items-start space-x-2.5 text-slate-300">
                <span className="text-slate-500 text-[10px] shrink-0">{log.timestamp.split("T")[1]?.slice(0, 8)}</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] shrink-0 ${
                    log.tipo === "tool_call"
                      ? "bg-purple-900/60 text-purple-300 border border-purple-700/50"
                      : log.tipo === "tool_result"
                      ? "bg-blue-900/60 text-blue-300 border border-blue-700/50"
                      : log.tipo === "schema_validation"
                      ? "bg-emerald-900/60 text-emerald-300 border border-emerald-700/50"
                      : log.tipo === "decision"
                      ? "bg-amber-900/60 text-amber-300 border border-amber-700/50"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {log.tipo}
                </span>
                <span className="text-slate-200">{log.mensaje}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Triage Output Card */}
      {triageResult && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          {/* Header Banner */}
          <div className="bg-slate-850 border-b border-slate-800 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg border ${
                  triageResult.severidad === "P1"
                    ? "bg-red-500/20 text-red-400 border-red-500/40"
                    : triageResult.severidad === "P2"
                    ? "bg-orange-500/20 text-orange-400 border-orange-500/40"
                    : triageResult.severidad === "P3"
                    ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                    : "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                }`}
              >
                {triageResult.severidad}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-bold text-white">
                    Triage Dictaminado: Severidad {triageResult.severidad}
                  </h3>
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                      triageResult.nivel_autonomia === "L2"
                        ? "bg-blue-900/40 text-blue-300 border-blue-600/50"
                        : "bg-amber-900/40 text-amber-300 border-amber-600/50"
                    }`}
                  >
                    Nivel {triageResult.nivel_autonomia} ({triageResult.nivel_autonomia === "L2" ? "Publica Triage" : "Borrador"})
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Servicio: <strong className="text-slate-200">{triageResult.servicio}</strong> • Confianza del diagnóstico:{" "}
                  <strong className="text-slate-200">{(triageResult.confianza * 100).toFixed(0)}%</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowRawJson(!showRawJson)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 rounded-lg flex items-center space-x-1 border border-slate-700"
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>{showRawJson ? "Ver Formato Visual" : "Ver JSON Schema"}</span>
              </button>
              <button
                onClick={handleCopyJson}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 rounded-lg flex items-center space-x-1 border border-slate-700"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copiado" : "Copiar"}</span>
              </button>
            </div>
          </div>

          {showRawJson ? (
            <div className="p-5 bg-slate-950">
              <pre className="text-xs font-mono text-emerald-300 bg-slate-900 p-4 rounded-lg overflow-x-auto border border-slate-800">
                {JSON.stringify(triageResult, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* Probable Cause & Recommended Action Highlight */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Causa Probable
                  </span>
                  <p className="text-sm text-slate-200 leading-relaxed">{triageResult.causa_probable}</p>
                </div>

                <div className="bg-blue-950/30 border border-blue-800/40 rounded-xl p-4">
                  <span className="text-[11px] font-bold text-blue-300 uppercase tracking-wider block mb-1.5 flex items-center space-x-1.5">
                    <ShieldCheck className="w-4 h-4 text-blue-400" />
                    <span>Acción Recomendada</span>
                  </span>
                  <p className="text-sm text-blue-100 font-medium leading-relaxed">{triageResult.accion_recomendada}</p>
                </div>
              </div>

              {/* Evidence Section */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
                  Evidencia Correlacionada (Obtenida de API de Monitoreo)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold mb-1">Métrica Actual</span>
                    <p className="text-slate-200">{triageResult.evidencia.metrica_actual}</p>
                  </div>
                  <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold mb-1">Comparación Histórica</span>
                    <p className="text-slate-200">{triageResult.evidencia.comparacion_historica}</p>
                  </div>
                  <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold mb-1">Incidente / Deploy Correlacionado</span>
                    <p className="text-slate-200">
                      {triageResult.evidencia.incidente_correlacionado ? (
                        <span className="text-amber-300 font-semibold">
                          {triageResult.evidencia.incidente_correlacionado}
                        </span>
                      ) : (
                        <span className="text-slate-500 italic">Ninguno correlacionado</span>
                      )}
                    </p>
                  </div>
                  <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold mb-1">Error de Herramienta</span>
                    <p className="text-slate-200">
                      {triageResult.evidencia.error_herramienta ? (
                        <span className="text-red-400 font-mono font-semibold">
                          {triageResult.evidencia.error_herramienta}
                        </span>
                      ) : (
                        <span className="text-emerald-400">null (Sin errores)</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Autonomy & Human Intervention Box */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <UserCheck className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-white">Supervisión Humana Requerida:</span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded ${
                        triageResult.requiere_intervencion_humana
                          ? "bg-amber-500/20 text-amber-300"
                          : "bg-emerald-500/20 text-emerald-300"
                      }`}
                    >
                      {triageResult.requiere_intervencion_humana ? "SÍ (Obligatoria)" : "NO"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Siguiente paso: <span className="text-slate-300">{triageResult.siguiente_paso}</span>
                  </p>
                </div>

                {triageResult.requiere_intervencion_humana && (
                  <button
                    onClick={() => setIsHitlModalOpen(true)}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-lg shadow flex items-center space-x-1.5 transition"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>{lastReview ? "Ver / Actualizar Firma On-Call" : "Firmar como Guardia On-Call"}</span>
                  </button>
                )}
              </div>

              {/* Recorded Human Review Display */}
              {lastReview && (
                <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-xl p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-300 flex items-center space-x-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Firma de Guardia Registrada en revision_humana.json</span>
                    </span>
                    <span className="text-emerald-400/80 font-mono text-[11px]">{lastReview.timestamp_revision_utc}</span>
                  </div>
                  <div className="text-slate-300 grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Revisor:</span>
                      <span className="font-semibold text-slate-200">{lastReview.revisor}</span> ({lastReview.rol})
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Decisión:</span>
                      <span className="font-semibold text-emerald-300">{lastReview.decision}</span>
                    </div>
                  </div>
                  <p className="text-slate-300 italic mt-1 bg-slate-900/80 p-2.5 rounded border border-emerald-900/40">
                    "{lastReview.decision_texto}"
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* HITL Modal */}
      {triageResult && (
        <HitlSignoffModal
          isOpen={isHitlModalOpen}
          onClose={() => setIsHitlModalOpen(false)}
          triage={triageResult}
          corridaId={selectedPreset === "preset-1" ? "corrida_01_p1_checkout_api" : "corrida_interactiva"}
          onReviewSubmitted={(review) => setLastReview(review)}
        />
      )}
    </div>
  );
};
