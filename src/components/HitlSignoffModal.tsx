import React, { useState } from "react";
import { UserCheck, ShieldAlert, Check, X, AlertTriangle } from "lucide-react";
import { TriageOutput } from "../types";

interface HitlSignoffModalProps {
  isOpen: boolean;
  onClose: () => void;
  triage: TriageOutput;
  corridaId: string;
  onReviewSubmitted: (reviewData: any) => void;
}

export const HitlSignoffModal: React.FC<HitlSignoffModalProps> = ({
  isOpen,
  onClose,
  triage,
  corridaId,
  onReviewSubmitted
}) => {
  const [revisor, setRevisor] = useState("");
  const [rol, setRol] = useState("Ingeniero de Guardia (On-Call)");
  const [decision, setDecision] = useState<string>("confirmar_y_autorizar");
  const [decisionTexto, setDecisionTexto] = useState(
    "Confirmo y autorizo la acción recomendada: coincide con la lectura de la evidencia métrica y correlación de eventos de infraestructura."
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        revisor,
        rol,
        decision,
        decision_texto: decisionTexto,
        triage_revisado: {
          severidad: triage.severidad,
          accion_recomendada: triage.accion_recomendada
        },
        accion_real_ejecutada:
          decision === "confirmar_y_autorizar"
            ? `Acción aprobada y autorizada por ${revisor} en canal de incidentes.`
            : `Decisión registrada: ${decision} por ${revisor}.`
      };

      const res = await fetch(`/api/corridas/${corridaId}/revision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        onReviewSubmitted(data.revision);
        onClose();
      }
    } catch (err) {
      console.error("Error submitting review:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-750 rounded-xl max-w-lg w-full p-6 shadow-2xl relative border-slate-800">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Supervisión Humana On-Call</h3>
            <p className="text-xs text-slate-400">Firma y validación de triage según política L2 (Pieza 6)</p>
          </div>
        </div>

        {/* Triage Summary Box */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3.5 mb-4 text-xs space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Alerta ID: <strong className="text-slate-200">{triage.alerta_id}</strong></span>
            <span className={`px-2 py-0.5 rounded font-bold ${
              triage.severidad === "P1" ? "bg-red-500/20 text-red-300 border border-red-500/30" : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
            }`}>
              Severidad {triage.severidad}
            </span>
          </div>
          <div>
            <span className="text-slate-400">Acción recomendada:</span>
            <p className="text-slate-200 font-medium mt-0.5">{triage.accion_recomendada}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre del Revisor (On-Call)</label>
            <input
              type="text"
              required
              placeholder="Ingresá tu nombre y apellido"
              value={revisor}
              onChange={(e) => setRevisor(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 placeholder-slate-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Rol / Cargo</label>
            <input
              type="text"
              required
              value={rol}
              onChange={(e) => setRol(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Decisión del Revisor</label>
            <select
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="confirmar_y_autorizar">Confirmar y autorizar acción recomendada (Aprobado)</option>
              <option value="escalar_a_tech_lead">Escalar a Tech Lead / Equipo de Pagos</option>
              <option value="rechazar_falso_positivo">Rechazar (Falso positivo / Ruido)</option>
              <option value="solicitar_mas_datos">Solicitar más métricas históricas</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Justificación / Dictamen de Guardia</label>
            <textarea
              rows={3}
              required
              value={decisionTexto}
              onChange={(e) => setDecisionTexto(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="bg-blue-950/40 border border-blue-800/40 rounded-lg p-2.5 flex items-start space-x-2 text-xs text-blue-300">
            <AlertTriangle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <span>
              Esta firma queda archivada en <code className="text-blue-200">revision_humana.json</code> con timestamp UTC y nombre auditables.
            </span>
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg flex items-center space-x-1.5 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? "Registrando..." : "Firmar y Registrar Decisión"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
