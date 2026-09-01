import React, { useState, useEffect } from "react";
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Cpu,
  UserCheck,
  Code2,
  Clock,
  Zap,
  ExternalLink,
  Copy,
  Check
} from "lucide-react";
import { CorridaCompleta } from "../types";

export const CorridasEvidence: React.FC = () => {
  const [corridas, setCorridas] = useState<CorridaCompleta[]>([]);
  const [selectedCorridaId, setSelectedCorridaId] = useState<string>("corrida_01_p1_checkout_api");
  const [activeFileView, setActiveFileView] = useState<"summary" | "input" | "tool_calls" | "output" | "metadata" | "human_review">("summary");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/corridas")
      .then((res) => res.json())
      .then((data) => {
        if (data.corridas) {
          setCorridas(data.corridas);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching corridas:", err);
        setLoading(false);
      });
  }, []);

  const selectedCorrida = corridas.find((c) => c.id === selectedCorridaId) || corridas[0];

  const handleCopy = (content: any) => {
    navigator.clipboard.writeText(typeof content === "string" ? content : JSON.stringify(content, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3" />
        <span>Cargando evidencia de corridas históricas...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Evidencia de Corridas Reales</h2>
            <p className="text-xs text-slate-400">
              Archivos reales de entrada, llamadas a herramientas HTTP, respuestas de LLM (Gemini/Claude), telemetría de tokens y firmas de control humano.
            </p>
          </div>
        </div>

        {/* 3 Corridas Selector Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          {corridas.map((corrida) => {
            const isSelected = selectedCorrida?.id === corrida.id;
            return (
              <div
                key={corrida.id}
                onClick={() => setSelectedCorridaId(corrida.id)}
                className={`cursor-pointer rounded-xl p-4 border transition-all text-left ${
                  isSelected
                    ? "bg-blue-950/40 border-blue-500 shadow-md shadow-blue-500/10"
                    : "bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded border ${
                      corrida.output.severidad === "P1"
                        ? "bg-red-500/20 text-red-300 border-red-500/30"
                        : corrida.output.severidad === "P2"
                        ? "bg-orange-500/20 text-orange-300 border-orange-500/30"
                        : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                    }`}
                  >
                    {corrida.output.severidad}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    Confianza: {(corrida.output.confianza * 100).toFixed(0)}%
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-white">{corrida.nombre}</h4>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{corrida.descripcion}</p>
                {corrida.revision_humana && (
                  <div className="mt-2 text-[10px] text-emerald-400 flex items-center space-x-1 font-medium">
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Firmado por {corrida.revision_humana.revisor}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Corrida Detail Box */}
      {selectedCorrida && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          {/* File Navigation Bar */}
          <div className="bg-slate-850 border-b border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto">
              {[
                { id: "summary", label: "Resumen y Triage", icon: Zap },
                { id: "input", label: "input.json", icon: FileText },
                { id: "tool_calls", label: "llamadas_herramienta.json", icon: Code2 },
                { id: "output", label: "output_crudo.json", icon: FileText },
                { id: "metadata", label: "metadata.json (Tokens)", icon: Cpu },
                { id: "human_review", label: "revision_humana.json", icon: UserCheck }
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeFileView === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveFileView(tab.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition ${
                      isActive
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => {
                let contentToCopy: any = selectedCorrida.output;
                if (activeFileView === "input") contentToCopy = selectedCorrida.input;
                if (activeFileView === "tool_calls") contentToCopy = selectedCorrida.llamadas;
                if (activeFileView === "metadata") contentToCopy = selectedCorrida.metadata;
                if (activeFileView === "human_review") contentToCopy = selectedCorrida.revision_humana;
                handleCopy(contentToCopy);
              }}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 rounded-lg flex items-center space-x-1 border border-slate-700"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copiado" : "Copiar Archivo"}</span>
            </button>
          </div>

          {/* Tab Content Display */}
          <div className="p-6">
            {activeFileView === "summary" && (
              <div className="space-y-6">
                {/* Meta stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase block font-semibold">Severidad Asignada</span>
                    <span className={`text-base font-bold ${
                      selectedCorrida.output.severidad === "P1" ? "text-red-400" : selectedCorrida.output.severidad === "P2" ? "text-orange-400" : "text-amber-400"
                    }`}>
                      {selectedCorrida.output.severidad}
                    </span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase block font-semibold">Confianza</span>
                    <span className="text-base font-bold text-white">
                      {(selectedCorrida.output.confianza * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase block font-semibold">Nivel Autonomía</span>
                    <span className="text-base font-bold text-blue-400">
                      {selectedCorrida.output.nivel_autonomia}
                    </span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase block font-semibold">Proveedor LLM</span>
                    <span className="text-base font-bold text-slate-200">
                      {selectedCorrida.metadata.modelo}
                    </span>
                  </div>
                </div>

                {/* Probable cause & action */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Causa Probable
                    </span>
                    <p className="text-sm text-slate-200">{selectedCorrida.output.causa_probable}</p>
                  </div>
                  <div className="bg-blue-950/30 p-4 rounded-xl border border-blue-800/40">
                    <span className="text-[11px] font-bold text-blue-300 uppercase tracking-wider block mb-1">
                      Acción Recomendada
                    </span>
                    <p className="text-sm text-blue-100 font-medium">{selectedCorrida.output.accion_recomendada}</p>
                  </div>
                </div>

                {/* Evidence table */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Evidencia Recopilada</h4>
                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 bg-slate-900 rounded border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between">
                      <span className="text-slate-400 font-semibold">Métrica Actual:</span>
                      <span className="text-slate-200 font-mono">{selectedCorrida.output.evidencia.metrica_actual}</span>
                    </div>
                    <div className="p-2.5 bg-slate-900 rounded border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between">
                      <span className="text-slate-400 font-semibold">Comparación Histórica:</span>
                      <span className="text-slate-200">{selectedCorrida.output.evidencia.comparacion_historica}</span>
                    </div>
                    <div className="p-2.5 bg-slate-900 rounded border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between">
                      <span className="text-slate-400 font-semibold">Incidente / Deploy:</span>
                      <span className="text-amber-300 font-semibold font-mono">
                        {selectedCorrida.output.evidencia.incidente_correlacionado || "Ninguno correlacionado"}
                      </span>
                    </div>
                    <div className="p-2.5 bg-slate-900 rounded border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between">
                      <span className="text-slate-400 font-semibold">Error de Herramienta:</span>
                      <span className={selectedCorrida.output.evidencia.error_herramienta ? "text-red-400 font-mono" : "text-emerald-400 font-mono"}>
                        {selectedCorrida.output.evidencia.error_herramienta || "null (Sin error)"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Human Review banner if present */}
                {selectedCorrida.revision_humana && (
                  <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-xl p-4 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-300 flex items-center space-x-1.5">
                        <UserCheck className="w-4 h-4" />
                        <span>Firma de Supervisión Humana On-Call ({selectedCorrida.revision_humana.revisor})</span>
                      </span>
                      <span className="text-emerald-400 font-mono text-[11px]">{selectedCorrida.revision_humana.timestamp_revision_utc}</span>
                    </div>
                    <p className="text-slate-300">
                      <strong>Decisión:</strong> <span className="text-emerald-300">{selectedCorrida.revision_humana.decision}</span>
                    </p>
                    <p className="text-slate-300 italic bg-slate-900 p-2 rounded border border-emerald-900/50">
                      "{selectedCorrida.revision_humana.decision_texto}"
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeFileView === "input" && (
              <pre className="text-xs font-mono text-emerald-300 bg-slate-950 p-4 rounded-lg overflow-x-auto border border-slate-800">
                {JSON.stringify(selectedCorrida.input, null, 2)}
              </pre>
            )}

            {activeFileView === "tool_calls" && (
              <pre className="text-xs font-mono text-purple-300 bg-slate-950 p-4 rounded-lg overflow-x-auto border border-slate-800">
                {JSON.stringify(selectedCorrida.llamadas, null, 2)}
              </pre>
            )}

            {activeFileView === "output" && (
              <pre className="text-xs font-mono text-cyan-300 bg-slate-950 p-4 rounded-lg overflow-x-auto border border-slate-800">
                {JSON.stringify(selectedCorrida.output, null, 2)}
              </pre>
            )}

            {activeFileView === "metadata" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs">
                    <span className="text-slate-500 block text-[10px]">Modelo / Proveedor</span>
                    <span className="font-bold text-white">{selectedCorrida.metadata.modelo}</span> ({selectedCorrida.metadata.proveedor})
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs">
                    <span className="text-slate-500 block text-[10px]">Modo de Generación</span>
                    <span className="font-bold text-emerald-400 uppercase">{selectedCorrida.metadata.modo_generacion}</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs">
                    <span className="text-slate-500 block text-[10px]">Llamadas a Herramienta</span>
                    <span className="font-bold text-blue-400">{selectedCorrida.metadata.cantidad_llamadas_herramienta}</span>
                  </div>
                </div>

                <pre className="text-xs font-mono text-amber-300 bg-slate-950 p-4 rounded-lg overflow-x-auto border border-slate-800">
                  {JSON.stringify(selectedCorrida.metadata, null, 2)}
                </pre>
              </div>
            )}

            {activeFileView === "human_review" && (
              <div className="space-y-3">
                {selectedCorrida.revision_humana ? (
                  <pre className="text-xs font-mono text-emerald-300 bg-slate-950 p-4 rounded-lg overflow-x-auto border border-slate-800">
                    {JSON.stringify(selectedCorrida.revision_humana, null, 2)}
                  </pre>
                ) : (
                  <div className="bg-slate-950 p-6 text-center text-slate-400 rounded-lg border border-slate-800 text-xs">
                    <p>No se requirió intervención humana inmediata para esta corrida ({selectedCorrida.output.severidad}).</p>
                    <p className="text-slate-500 mt-1">Los triages P3/P4 se auditan en la reunión semanal de guardia.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
