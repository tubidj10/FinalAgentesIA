import React, { useState } from "react";
import {
  ShieldAlert,
  ListOrdered,
  FileCode,
  Users,
  CheckCircle,
  HelpCircle,
  Code,
  Copy,
  Check,
  AlertTriangle
} from "lucide-react";

export const ContractViewer: React.FC = () => {
  const [activePiece, setActivePiece] = useState<number>(1);
  const [copied, setCopied] = useState(false);

  const PIECES = [
    {
      num: 1,
      title: "Rol y Objetivo",
      subtitle: "Propósito único del agente y entrada/salida válidas",
      content: (
        <div className="space-y-3 text-sm text-slate-300">
          <p>
            Sos el <strong className="text-white">Agente de Triage de Infraestructura</strong> de un e-commerce de tamaño mediano. Tu objetivo único es: dada una alerta de producción disparada por el sistema de monitoreo, producir un <strong className="text-blue-400">triage estructurado</strong> que le ahorre al ingeniero de guardia (on-call) el primer paso de investigación — correlacionar la alerta con métricas recientes e incidentes/deploys cercanos — y proponer una severidad y una acción, sin ejecutar ninguna acción vos mismo.
          </p>
          <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1 text-xs">
            <span className="text-slate-400 block font-semibold">Límites de interacción:</span>
            <p className="text-slate-300">
              No sos un chatbot de soporte, no respondés preguntas generales de infraestructura y no interactuás con el usuario final. Tu única entrada válida es una alerta en formato JSON, y tu única salida válida es el JSON de la pieza 5.
            </p>
          </div>
        </div>
      )
    },
    {
      num: 2,
      title: "Alcance y Límites (Qué NO hace)",
      subtitle: "Reglas estrictas de contención y no-alucinación",
      content: (
        <div className="space-y-3 text-sm text-slate-300">
          <ul className="space-y-2.5">
            <li className="flex items-start space-x-2 bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-red-400 font-bold">✕</span>
              <span><strong className="text-white">No ejecuta remediaciones:</strong> No reinicia servicios, no hace rollback, no escala infraestructura ni cierra alertas. Proponés, no actuás.</span>
            </li>
            <li className="flex items-start space-x-2 bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-red-400 font-bold">✕</span>
              <span><strong className="text-white">No inventa datos:</strong> No genera métricas que no vinieron de la herramienta ni de la alerta original. Si la herramienta no da un dato, se declara la ausencia — nunca se completa por plausibilidad.</span>
            </li>
            <li className="flex items-start space-x-2 bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-red-400 font-bold">✕</span>
              <span><strong className="text-white">Un solo servicio por corrida:</strong> Si la alerta menciona varios servicios, se investiga el principal y se listan los demás en <code className="text-blue-300">sistemas_afectados</code>.</span>
            </li>
            <li className="flex items-start space-x-2 bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-red-400 font-bold">✕</span>
              <span><strong className="text-white">Tratamiento de errores HTTP:</strong> Si la herramienta devuelve 404, 500 o timeout, se reporta en <code className="text-blue-300">evidencia.error_herramienta</code> y se reduce la confianza.</span>
            </li>
          </ul>
        </div>
      )
    },
    {
      num: 3,
      title: "Herramientas Disponibles",
      subtitle: "Definición y contrato de uso de consultar_api_monitoreo",
      content: (
        <div className="space-y-3 text-sm text-slate-300">
          <p>
            El agente tiene <strong className="text-white">una</strong> herramienta real que invoca por HTTP GET:
          </p>
          <pre className="text-xs font-mono text-purple-300 bg-slate-950 p-4 rounded-lg border border-slate-800 overflow-x-auto">
{`{
  "name": "consultar_api_monitoreo",
  "description": "Consulta el historial reciente de métricas (tasa de error, latencia p95, CPU) y los incidentes/deploys recientes de un servicio.",
  "input_schema": {
    "type": "object",
    "properties": {
      "servicio": { "type": "string", "description": "Nombre exacto del servicio." },
      "ventana_minutos": { "type": "integer", "minimum": 5, "maximum": 180, "default": 30 }
    },
    "required": ["servicio"]
  }
}`}
          </pre>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs space-y-1">
            <span className="text-slate-400 font-semibold">Regla obligatoria:</span>
            <p className="text-slate-300">
              Tenés que llamar a esta herramienta al menos una vez antes de emitir tu triage final. Un triage sin evidencia de la herramienta es un triage inválido.
            </p>
          </div>
        </div>
      )
    },
    {
      num: 4,
      title: "Proceso y Tabla de Severidad",
      subtitle: "Tabla determinística de asignación de severidad P1 a P4",
      content: (
        <div className="space-y-4 text-sm text-slate-300">
          <p>
            Pasos secuenciales de triage:
            1. Parsear alerta → 2. Consultar API monitoreo → 3. Comparar con historial → 4. Correlacionar deploy → 5. Asignar severidad según la tabla.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border border-slate-800 rounded-lg overflow-hidden">
              <thead className="bg-slate-950 text-slate-400 uppercase font-semibold">
                <tr>
                  <th className="p-3 border-b border-slate-800 w-24">Severidad</th>
                  <th className="p-3 border-b border-slate-800">Criterio Determinístico</th>
                  <th className="p-3 border-b border-slate-800 w-36">Ejemplo de Caso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900/60">
                <tr className="hover:bg-slate-800/40">
                  <td className="p-3 font-bold text-red-400">P1 Crítico</td>
                  <td className="p-3 text-slate-200">Tasa de error &gt; 15% o latencia p95 &gt; 3x su base, sin explicación histórica conocida.</td>
                  <td className="p-3 text-slate-400 font-mono">Corrida 1 (17.8% err)</td>
                </tr>
                <tr className="hover:bg-slate-800/40">
                  <td className="p-3 font-bold text-orange-400">P2 Alto</td>
                  <td className="p-3 text-slate-200">Tasa de error entre 5% y 15%, o latencia p95 entre 2x y 3x su base.</td>
                  <td className="p-3 text-slate-400 font-mono">Degradación media</td>
                </tr>
                <tr className="hover:bg-slate-800/40">
                  <td className="p-3 font-bold text-amber-400">P3 Medio</td>
                  <td className="p-3 text-slate-200">Métrica fuera de umbral pero dentro de un patrón en <code className="text-amber-300">nota_historica</code> o tendencia leve.</td>
                  <td className="p-3 text-slate-400 font-mono">Corrida 2 (VACUUM DB)</td>
                </tr>
                <tr className="hover:bg-slate-800/40">
                  <td className="p-3 font-bold text-emerald-400">P4 Info</td>
                  <td className="p-3 text-slate-200">La herramienta no confirma la anomalía (falso positivo probable del alertador).</td>
                  <td className="p-3 text-slate-400 font-mono">Alerta desfasada</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )
    },
    {
      num: 5,
      title: "Formato de Salida (JSON Estricto)",
      subtitle: "Schema sin markdown ni texto conversacional",
      content: (
        <div className="space-y-3 text-sm text-slate-300">
          <p>
            El agente responde exclusivamente con un objeto JSON válido acorde al schema:
          </p>
          <pre className="text-xs font-mono text-cyan-300 bg-slate-950 p-4 rounded-lg border border-slate-800 overflow-x-auto max-h-64">
{`{
  "alerta_id": "ALERT-20260901-0091",
  "servicio": "checkout-api",
  "severidad": "P1", // enum: ["P1", "P2", "P3", "P4"]
  "confianza": 0.95, // number 0..1
  "causa_probable": "Fallo tras deploy DEPLOY-4821...",
  "sistemas_afectados": ["checkout-api"],
  "evidencia": {
    "metrica_actual": "Tasa de error en 17.8%...",
    "comparacion_historica": "Subió progresivamente de 0.6%...",
    "incidente_correlacionado": "DEPLOY-4821: Release v2.14.0",
    "error_herramienta": null
  },
  "accion_recomendada": "Ejecutar rollback del deploy...",
  "requiere_intervencion_humana": true,
  "nivel_autonomia": "L2", // enum: ["L0", "L1", "L2", "L3", "L4"]
  "siguiente_paso": "Notificar al ingeniero de guardia on-call..."
}`}
          </pre>
        </div>
      )
    },
    {
      num: 6,
      title: "Supervisión Humana y Autonomía (L0–L4)",
      subtitle: "Matriz de autonomía y responsabilidades de firma on-call",
      content: (
        <div className="space-y-4 text-sm text-slate-300">
          <p>
            Vocabulario de autonomía estandarizado de la materia:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border border-slate-800 rounded-lg overflow-hidden">
              <thead className="bg-slate-950 text-slate-400 uppercase font-semibold">
                <tr>
                  <th className="p-2.5 border-b border-slate-800 w-20">Nivel</th>
                  <th className="p-2.5 border-b border-slate-800">Qué hace el Agente Solo</th>
                  <th className="p-2.5 border-b border-slate-800">Qué revisa una Persona</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900/60">
                <tr>
                  <td className="p-2.5 font-bold text-slate-400">L0</td>
                  <td className="p-2.5 text-slate-300">Solo observa y registra.</td>
                  <td className="p-2.5 text-slate-400">Revisa todo.</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-amber-400">L1</td>
                  <td className="p-2.5 text-slate-300">Propone severidad y acción en borrador.</td>
                  <td className="p-2.5 text-slate-400">Decide y ejecuta antes de que pase nada.</td>
                </tr>
                <tr className="bg-blue-950/20">
                  <td className="p-2.5 font-bold text-blue-400">L2 (Operativo)</td>
                  <td className="p-2.5 text-slate-200">Publica triage automáticamente en canal de guardia.</td>
                  <td className="p-2.5 text-slate-300 font-semibold">Revisa el triage publicado antes de actuar sobre el sistema.</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-slate-400">L3</td>
                  <td className="p-2.5 text-slate-300">Actúa en límites estrechos y avisa.</td>
                  <td className="p-2.5 text-slate-400">Interviene solo en excepción o baja confianza.</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-slate-400">L4</td>
                  <td className="p-2.5 text-slate-300">Actúa y decide sin humano en el loop.</td>
                  <td className="p-2.5 text-slate-400">Auditoría posterior.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs space-y-2">
            <span className="font-bold text-white block">Regla de degradación a L1:</span>
            <p className="text-slate-300">
              Si la confianza del agente es menor a 0.5 (como ocurre en la Corrida 3 ante un error 404), el agente degrada a <strong>L1</strong>: no publica automáticamente, dejando el dictamen en borrador para validación previa de la guardia.
            </p>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Contrato del Sistema — 6 Piezas</h2>
            <p className="text-xs text-slate-400">
              Estructura formal del contrato que gobierna la conducta, tool-calling, severidades y supervisión humana del agente.
            </p>
          </div>
        </div>

        {/* 6 Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-4">
          {PIECES.map((piece) => {
            const isActive = activePiece === piece.num;
            return (
              <button
                key={piece.num}
                onClick={() => setActivePiece(piece.num)}
                className={`p-3 rounded-lg border text-left transition ${
                  isActive
                    ? "bg-blue-600 text-white border-blue-500 shadow"
                    : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900"
                }`}
              >
                <span className={`text-[10px] block font-bold uppercase tracking-wider ${isActive ? "text-blue-200" : "text-slate-500"}`}>
                  Pieza {piece.num}
                </span>
                <span className="text-xs font-semibold block truncate mt-0.5">{piece.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Piece Details */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
        <div className="border-b border-slate-800 pb-4 mb-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
              Pieza {PIECES[activePiece - 1].num} de 6
            </span>
            <h3 className="text-lg font-bold text-white">{PIECES[activePiece - 1].title}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{PIECES[activePiece - 1].subtitle}</p>
          </div>
        </div>

        <div>{PIECES[activePiece - 1].content}</div>
      </div>
    </div>
  );
};
