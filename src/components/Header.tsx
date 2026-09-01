import React from "react";
import { Activity, ShieldAlert, Cpu, CheckCircle2, Terminal } from "lucide-react";

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onQuickRunCorrida?: (id: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base font-bold text-white tracking-tight">
                  Agente de Triage de Infraestructura
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-900/60 text-blue-300 border border-blue-700/50">
                  L2 Supervisado
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                MBA UCEMA — Triage automatizado de alertas de producción con Tool-Calling & HITL
              </p>
            </div>
          </div>

          {/* System Status Badges */}
          <div className="flex items-center space-x-3">
            <div className="hidden md:flex items-center space-x-2 text-xs bg-slate-950/80 px-3 py-1.5 rounded-md border border-slate-800">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-slate-300 font-mono">API Monitoreo: Activa</span>
            </div>

            <div className="hidden lg:flex items-center space-x-1.5 text-xs bg-slate-950/80 px-3 py-1.5 rounded-md border border-slate-800">
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-slate-300">Gemini / Claude Haiku 4.5</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 sm:space-x-4 -mb-px overflow-x-auto no-scrollbar pt-1">
          {[
            { id: "runner", label: "Ejecutor de Triage", icon: Terminal },
            { id: "evidence", label: "Evidencia de Corridas", icon: CheckCircle2 },
            { id: "monitoring", label: "Métricas y Monitoreo", icon: Activity },
            { id: "contract", label: "Contrato y Prompts", icon: ShieldAlert },
            { id: "decisions", label: "Bitácora y Economía", icon: Cpu }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-3 px-3.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  isActive
                    ? "border-blue-500 text-blue-400 bg-blue-500/5"
                    : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-blue-400" : "text-slate-500"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
