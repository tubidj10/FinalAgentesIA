import React, { useState } from "react";
import { Header } from "./components/Header";
import { TriageRunner } from "./components/TriageRunner";
import { CorridasEvidence } from "./components/CorridasEvidence";
import { MonitoringExplorer } from "./components/MonitoringExplorer";
import { ContractViewer } from "./components/ContractViewer";
import { DecisionesLog } from "./components/DecisionesLog";

export default function App() {
  const [activeTab, setActiveTab] = useState<string>("runner");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-blue-500 selection:text-white">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === "runner" && <TriageRunner />}
        {activeTab === "evidence" && <CorridasEvidence />}
        {activeTab === "monitoring" && <MonitoringExplorer />}
        {activeTab === "contract" && <ContractViewer />}
        {activeTab === "decisiones" || activeTab === "decisions" ? <DecisionesLog /> : null}
      </main>

      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Agente de Triage de Infraestructura — MBA UCEMA</span>
          <span className="font-mono text-[11px] text-slate-600">
            Nivel L2 Supervisado • Tool Calling HTTP • Google AI Studio
          </span>
        </div>
      </footer>
    </div>
  );
}
