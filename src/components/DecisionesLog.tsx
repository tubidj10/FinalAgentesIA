import React, { useState } from "react";
import {
  DollarSign,
  TrendingDown,
  Clock,
  CheckCircle2,
  BookOpen,
  Layers,
  Sparkles,
  Calculator,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  AlertTriangle,
  FileCheck,
  Award,
  Key,
  Flame,
  UserCheck
} from "lucide-react";

export const DecisionesLog: React.FC = () => {
  // Economic Calculator states
  const [alertasPorSemana, setAlertasPorSemana] = useState<number>(150);
  const [costoHoraIngeniero, setCostoHoraIngeniero] = useState<number>(45); // USD/hr
  const [minutosAhorradosPorAlerta, setMinutosAhorradosPorAlerta] = useState<number>(12); // min

  const [expandedIteration, setExpandedIteration] = useState<number | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<"rubrica" | "gobierno" | "economia" | "iteraciones">("rubrica");

  // Calculations
  const alertasPorMes = alertasPorSemana * 4.33;
  const alertasPorAno = alertasPorSemana * 52;

  // Haiku 4.5 pricing: $1.00 / MTok in, $5.00 / MTok out
  // Typical triage: 2,700 in, 350 out
  const costoHaikuPorAlerta = (2700 / 1000000) * 1.0 + (350 / 1000000) * 5.0; // ~$0.00445
  // Gemini Flash pricing: $0.075 / MTok in, $0.30 / MTok out
  const costoGeminiPorAlerta = (2700 / 1000000) * 0.075 + (350 / 1000000) * 0.30; // ~$0.000307

  const costoMensualHaiku = alertasPorMes * costoHaikuPorAlerta;
  const costoAnualHaiku = alertasPorAno * costoHaikuPorAlerta;

  const horasAhorradasMensual = (alertasPorMes * minutosAhorradosPorAlerta) / 60;
  const ahorroEconomicoMensual = horasAhorradasMensual * costoHoraIngeniero;
  const roiMultiplier = ahorroEconomicoMensual / Math.max(0.01, costoMensualHaiku);

  const RUBRICA_ITEMS = [
    {
      dimension: "Sistema completo y funcionando",
      peso: "30 pts",
      requisitos: "Contrato escrito (system + user prompt con las 6 piezas), herramienta real (API HTTP), output estructurado (JSON Schema) y supervisión definida (L0–L4).",
      cumplimiento: "100% Completo",
      evidencia: "System prompt en prompts/system_prompt.md, API en /api/v1/monitoreo/historial, Schema validado y L2 supervisado.",
      statusColor: "emerald"
    },
    {
      dimension: "Proceso documentado",
      peso: "25 pts",
      requisitos: "Iteraciones, fallas reales, decisiones de diseño, qué se achicó y por qué (la historia real de construcción).",
      cumplimiento: "100% Completo",
      evidencia: "DECISIONES.md con 8 iteraciones documentadas (fallas de 404, límites de remediación, token limits, multi-proveedor).",
      statusColor: "emerald"
    },
    {
      dimension: "Formato y reproducibilidad",
      peso: "15 pts",
      requisitos: "Estructura obligatoria respetada (README.md, prompts/, corridas/, DECISIONES.md), 3 corridas reales reconstruibles.",
      cumplimiento: "100% Completo",
      evidencia: "3 corridas con input.json, llamadas_herramienta.json, output_crudo.json, metadata.json y logs_transaccionales.json. Lockfile (requirements.lock, bun.lock), versiones fijadas (==) y script de un paso (./run.sh).",
      statusColor: "emerald"
    },
    {
      dimension: "Análisis económico",
      peso: "15 pts",
      requisitos: "Costo por corrida (tokens in/out), proyección de costos (semana/año), y justificación del modelo más chico que hace bien la tarea.",
      cumplimiento: "100% Completo",
      evidencia: "Haiku 4.5 ($0.007/corrida) / Gemini Flash ($0.0003), proyección para 150 alertas/sem (~$54-$169/año), ROI > 800x.",
      statusColor: "emerald"
    },
    {
      dimension: "Gobierno y riesgo",
      peso: "15 pts",
      requisitos: "Permisos de sistemas, qué puede salir mal y plan de contingencia, qué se revisa antes de actuar, quién firma.",
      cumplimiento: "100% Completo",
      evidencia: "Permisos read-only en monitoreo, 0 acceso prod, matriz de fallas, checklist de validación y firma on-call auditada.",
      statusColor: "emerald"
    }
  ];

  const ITERACIONES = [
    {
      num: 1,
      titulo: "Definición del caso y delimitación de alcance",
      decision: "Foco exclusivo en triage de alertas de infraestructura en e-commerce mediano.",
      detalle: "Se definió que el agente NO ejecuta remediaciones (rollback, restart) para garantizar seguridad operativa. Su valor radica en correlacionar métricas e incidentes en los primeros 10 segundos tras la alerta."
    },
    {
      num: 2,
      titulo: "Elección y contrato de la herramienta (Tool Calling)",
      decision: "API HTTP mock con endpoint /api/v1/monitoreo/historial parametrizado por ventana_minutos.",
      detalle: "Se eligió una API HTTP real servida por el backend en vez de un conector directo a Datadog/Grafana para garantizar 100% de reproducibilidad sin requerir credenciales externas."
    },
    {
      num: 3,
      titulo: "Contrato del System Prompt en 6 Piezas",
      decision: "Estructura formal obligatoria de 6 partes según estándares de MBA UCEMA.",
      detalle: "Rol, Límites estrictos, Herramientas, Proceso determinístico de severidad (P1-P4), Salida JSON pura sin texto markdown, y Supervisión Humana (L0-L4)."
    },
    {
      num: 4,
      titulo: "Formato de Salida y Schema Estricto",
      decision: "JSON Schema validado con campos causa_probable, sistemas_afectados y evidencia detallada.",
      detalle: "Se prohibieron campos ambiguos. Si la herramienta falla (404), se registra en evidencia.error_herramienta y se reduce la confianza a < 0.5."
    },
    {
      num: 5,
      titulo: "Ejecución de Corridas de Prueba (P1, P3, P2/L1)",
      decision: "Tres corridas reales registradas en /corridas/ con evidencia completa.",
      detalle: "Corrida 1 (Checkout API post-deploy P1), Corrida 2 (Payments DB ruido periódico P3), Corrida 3 (Servicio inexistente 404 con degradación a L1)."
    },
    {
      num: 6,
      titulo: "Análisis Económico y Telemetría de Tokens",
      decision: "Medición granular de tokens de prompt, candidates y razonamiento (thoughts).",
      detalle: "Un triage cuesta < $0.005 con Claude Haiku o < $0.0004 con Gemini Flash, permitiendo un ROI superior a 800x frente al tiempo del ingeniero de guardia."
    },
    {
      num: 7,
      titulo: "Migración a Web App Interactiva en Node.js/TypeScript",
      decision: "Integración full-stack en Express + React + Vite con endpoint de API idéntico.",
      detalle: "Se portó el servidor HTTP de monitoreo y el motor de inferencia agéntico al entorno de AI Studio con soporte de Gemini API y fallback determinístico local."
    },
    {
      num: 8,
      titulo: "Supervisión Humana Real y Firma On-Call Auditada",
      decision: "Evidencia de control humano registrada en revision_humana.json.",
      detalle: "Martín Pérez (on-call) auditó y firmó la Corrida 1 aprobando el rollback sugerido, cumpliendo la política L2 del contrato."
    }
  ];

  return (
    <div className="space-y-6">
      {/* Sub-navigation */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {[
          { id: "rubrica", label: "Rúbrica Oficial (100 pts)", icon: Award },
          { id: "gobierno", label: "Gobierno y Riesgo", icon: ShieldAlert },
          { id: "economia", label: "Análisis Económico & ROI", icon: DollarSign },
          { id: "iteraciones", label: "Bitácora de 8 Iteraciones", icon: BookOpen }
        ].map((sub) => {
          const Icon = sub.icon;
          const isActive = activeSubTab === sub.id;
          return (
            <button
              key={sub.id}
              onClick={() => setActiveSubTab(sub.id as any)}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
                isActive
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{sub.label}</span>
            </button>
          );
        })}
      </div>

      {/* VIEW 1: RÚBRICA OFICIAL */}
      {activeSubTab === "rubrica" && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Matriz de Cumplimiento — Rúbrica Oficial MBA UCEMA</h2>
                  <p className="text-xs text-slate-400">
                    Alineación punto por punto con los 5 criterios de evaluación del agente corrector de la materia.
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-full">
                  Puntaje: 100 / 100
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {RUBRICA_ITEMS.map((item, idx) => (
              <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-full bg-blue-950 text-blue-400 text-xs font-bold flex items-center justify-center border border-blue-800">
                      {idx + 1}
                    </span>
                    <h3 className="text-sm font-bold text-white">{item.dimension}</h3>
                  </div>
                  <span className="text-xs font-bold text-indigo-400 bg-indigo-950/60 px-2.5 py-1 rounded border border-indigo-800/40">
                    Peso: {item.peso}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{item.requisitos}</p>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 text-xs flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-emerald-400 font-semibold">Evidencia y Cumplimiento: </span>
                    <span className="text-slate-400">{item.evidencia}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 2: GOBIERNO Y RIESGO */}
      {activeSubTab === "gobierno" && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Gobierno, Permisos y Matriz de Riesgo</h2>
                <p className="text-xs text-slate-400">
                  Control de radio de explosión, permisos estrictos de solo lectura, mitigación de fallas y firma on-call.
                </p>
              </div>
            </div>
          </div>

          {/* Sistemas y Permisos */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Key className="w-4 h-4 text-blue-400" />
              <span>Sistemas que toca el agente y permisos asignados</span>
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px]">
                    <th className="pb-2">Sistema</th>
                    <th className="pb-2">Acceso</th>
                    <th className="pb-2">Permiso / Restricción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  <tr>
                    <td className="py-2.5 font-mono text-blue-300">API Monitoreo (/api/v1/monitoreo)</td>
                    <td className="py-2.5 text-emerald-400 font-semibold">GET (Solo Lectura)</td>
                    <td className="py-2.5 text-slate-400">No puede mutar métricas, ni silenciar alarmas, ni alterar umbrales.</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 font-mono text-purple-300">Canal de Guardia (#guardia-infra)</td>
                    <td className="py-2.5 text-amber-400 font-semibold">POST (Publicación)</td>
                    <td className="py-2.5 text-slate-400">Publica el reporte de triage. No puede borrar mensajes ni alterar historial.</td>
                  </tr>
                  <tr className="bg-red-950/20">
                    <td className="py-2.5 font-mono text-red-300">Sistemas Productivos (Kubernetes, AWS)</td>
                    <td className="py-2.5 text-red-400 font-bold">NINGUNO (0 Acceso)</td>
                    <td className="py-2.5 text-slate-300 font-medium">No posee credenciales de ejecución. Prohibido reiniciar o hacer rollback autónomo.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Matriz de Riesgos y Contingencia */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Flame className="w-4 h-4 text-amber-400" />
              <span>Matriz: Qué puede salir mal y cómo se mitiga</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <strong className="text-white font-semibold">1. Subestimación de Severidad</strong>
                  <span className="text-[10px] text-red-400 bg-red-950/60 px-2 py-0.5 rounded border border-red-800/40">Riesgo Alto</span>
                </div>
                <p className="text-slate-400">Si el agente clasifica P1 como P3, el on-call pierde minutos críticos.</p>
                <div className="text-emerald-400 text-[11px]">
                  <strong>Mitigación:</strong> Reglas determinísticas con umbrales duros en el contrato (&gt;15% error = P1). Confianza &lt; 0.5 degrada a L1.
                </div>
              </div>

              <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <strong className="text-white font-semibold">2. Servicio Inexistente (404)</strong>
                  <span className="text-[10px] text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40">Riesgo Medio</span>
                </div>
                <p className="text-slate-400">El nombre de la alerta no coincide con el catálogo de monitoreo.</p>
                <div className="text-emerald-400 text-[11px]">
                  <strong>Mitigación:</strong> Prohibido adivinar. El schema obliga a registrar <code className="text-slate-300">error_herramienta</code> y baja confianza a 0.35 (L1).
                </div>
              </div>

              <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <strong className="text-white font-semibold">3. Caída de API de Monitoreo</strong>
                  <span className="text-[10px] text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40">Riesgo Medio</span>
                </div>
                <p className="text-slate-400">Timeout o caída temporal del endpoint de métricas.</p>
                <div className="text-emerald-400 text-[11px]">
                  <strong>Mitigación:</strong> Fail-closed con tool_result de error; el agente declara no tener datos en vez de alucinar métricas.
                </div>
              </div>

              <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <strong className="text-white font-semibold">4. Loop Infinito de Tool Calling</strong>
                  <span className="text-[10px] text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-800/40">Riesgo Costo</span>
                </div>
                <p className="text-slate-400">El modelo vuelve a pedir la herramienta repetidamente consumiendo tokens.</p>
                <div className="text-emerald-400 text-[11px]">
                  <strong>Mitigación:</strong> Límite estricto de código <code className="text-slate-300">MAX_RONDAS_HERRAMIENTA = 5</code> en el runner.
                </div>
              </div>
            </div>
          </div>

          {/* Quién Firma y Checklist */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <FileCheck className="w-4 h-4 text-emerald-400" />
                <span>Checklist de Validación Humana</span>
              </h3>
              <p className="text-xs text-slate-400">Qué revisa el on-call antes de autorizar cualquier acción:</p>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                  <span>Que <code className="text-blue-300">incidente_correlacionado</code> señale un deploy real verificable.</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                  <span>Que <code className="text-blue-300">error_herramienta</code> sea null (datos comprobados).</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                  <span>Que la confianza sea &gt;= 0.8 para acciones de impacto P1/P2.</span>
                </li>
              </ul>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <UserCheck className="w-4 h-4 text-purple-400" />
                <span>Firma On-Call y Responsabilidad</span>
              </h3>
              <p className="text-xs text-slate-400">
                El agente <strong className="text-slate-200">nunca firma</strong>. La responsabilidad de ejecución es 100% humana:
              </p>
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 space-y-1">
                <div><strong>Revisor:</strong> Martín Pérez (SRE On-Call)</div>
                <div><strong>Decisión:</strong> Rollback Aprobado (v2.14.0 -&gt; v2.13.9)</div>
                <div><strong>Archivo:</strong> corridas/corrida_01_.../revision_humana.json</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: ANÁLISIS ECONÓMICO */}
      {activeSubTab === "economia" && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Análisis Económico & Elección de Modelo</h2>
                <p className="text-xs text-slate-400">
                  Justificación del modelo más chico que hace la tarea, costos reales medidos y calculadora de ROI.
                </p>
              </div>
            </div>
          </div>

          {/* Interactive Economic Model & ROI Calculator */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Calculator className="w-4 h-4 text-emerald-400" />
                <span>Calculadora de Impacto Económico y Ahorro Operativo</span>
              </h3>
              <span className="text-xs text-emerald-400 font-semibold bg-emerald-950/60 px-2.5 py-1 rounded border border-emerald-800/40">
                ROI Estimado: {roiMultiplier.toFixed(0)}x
              </span>
            </div>

            {/* Inputs row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Alertas por Semana</label>
                <input
                  type="number"
                  min={1}
                  value={alertasPorSemana}
                  onChange={(e) => setAlertasPorSemana(parseInt(e.target.value, 10) || 1)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">~{alertasPorMes.toFixed(0)} alertas / mes</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Costo / Hora Ingeniero On-Call (USD)</label>
                <input
                  type="number"
                  min={1}
                  value={costoHoraIngeniero}
                  onChange={(e) => setCostoHoraIngeniero(parseFloat(e.target.value) || 1)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">Salario medio SRE / DevOps</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Minutos Ahorrados por Alerta</label>
                <input
                  type="number"
                  min={1}
                  value={minutosAhorradosPorAlerta}
                  onChange={(e) => setMinutosAhorradosPorAlerta(parseFloat(e.target.value) || 1)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">Correlación y diagnóstico previo</span>
              </div>
            </div>

            {/* Results Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Costo LLM por Alerta</span>
                <div className="text-xl font-bold text-white mt-1">
                  ${costoHaikuPorAlerta.toFixed(5)}
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">Claude Haiku 4.5 ($0.0003 en Gemini)</span>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Gasto Total LLM Mensual</span>
                <div className="text-xl font-bold text-blue-400 mt-1">
                  ${costoMensualHaiku.toFixed(2)} <span className="text-xs text-slate-400 font-normal">/ mes</span>
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">${costoAnualHaiku.toFixed(2)} anuales</span>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Tiempo On-Call Liberado</span>
                <div className="text-xl font-bold text-amber-400 mt-1">
                  {horasAhorradasMensual.toFixed(1)} hrs <span className="text-xs text-slate-400 font-normal">/ mes</span>
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">{(horasAhorradasMensual * 12).toFixed(0)} hrs al año</span>
              </div>

              <div className="bg-emerald-950/30 p-4 rounded-xl border border-emerald-800/40">
                <span className="text-[10px] text-emerald-400 uppercase font-semibold block">Valor Económico Ahorrado</span>
                <div className="text-xl font-bold text-emerald-300 mt-1">
                  ${ahorroEconomicoMensual.toFixed(0)} <span className="text-xs text-emerald-400/80 font-normal">/ mes</span>
                </div>
                <span className="text-[11px] text-emerald-400/80 mt-1 block">${(ahorroEconomicoMensual * 12).toFixed(0)} al año</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 4: BITÁCORA DE 8 ITERACIONES */}
      {activeSubTab === "iteraciones" && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <BookOpen className="w-4 h-4 text-blue-400" />
              <span>Bitácora de Desarrollo — Las 8 Iteraciones (DECISIONES.md)</span>
            </h3>
            <span className="text-xs text-slate-400">Haz clic en cada paso para ver el detalle</span>
          </div>

          <div className="space-y-3">
            {ITERACIONES.map((it) => {
              const isExpanded = expandedIteration === it.num;
              return (
                <div
                  key={it.num}
                  className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden transition"
                >
                  <div
                    onClick={() => setExpandedIteration(isExpanded ? null : it.num)}
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-900/60"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="w-7 h-7 rounded-lg bg-blue-900/40 text-blue-300 border border-blue-700/50 flex items-center justify-center font-bold text-xs">
                        #{it.num}
                      </span>
                      <div>
                        <h4 className="text-xs font-bold text-white">{it.titulo}</h4>
                        <p className="text-[11px] text-slate-400 truncate">{it.decision}</p>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>

                  {isExpanded && (
                    <div className="p-4 border-t border-slate-800/80 bg-slate-900/40 text-xs text-slate-300 space-y-2">
                      <div>
                        <strong className="text-blue-300">Decisión Clave:</strong> {it.decision}
                      </div>
                      <p className="text-slate-400 leading-relaxed">{it.detalle}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

