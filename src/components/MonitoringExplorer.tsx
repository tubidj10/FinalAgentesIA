import React, { useState, useEffect } from "react";
import {
  Activity,
  Server,
  Database,
  Clock,
  Play,
  TrendingUp,
  AlertOctagon,
  Shield,
  Layers,
  FileCode2,
  CheckCircle2,
  XCircle
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import { ServicioDetalle } from "../types";

export const MonitoringExplorer: React.FC = () => {
  const [servicios, setServicios] = useState<ServicioDetalle[]>([]);
  const [selectedServicioName, setSelectedServicioName] = useState<string>("checkout-api");
  const [loading, setLoading] = useState(true);

  // Live Query Tester states
  const [testServicio, setTestServicio] = useState<string>("checkout-api");
  const [testVentana, setTestVentana] = useState<number>(30);
  const [testResponse, setTestResponse] = useState<any>(null);
  const [testStatus, setTestStatus] = useState<number | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    fetch("/api/v1/servicios")
      .then((res) => res.json())
      .then((data) => {
        if (data.servicios) {
          setServicios(data.servicios);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching services:", err);
        setLoading(false);
      });
  }, []);

  const selectedServicio = servicios.find((s) => s.servicio === selectedServicioName) || servicios[0];

  const handleTestApi = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTesting(true);
    try {
      const res = await fetch(`/api/v1/monitoreo/historial?servicio=${encodeURIComponent(testServicio)}&ventana_minutos=${testVentana}`);
      const data = await res.json();
      setTestStatus(res.status);
      setTestResponse(data);
    } catch (err: any) {
      setTestStatus(500);
      setTestResponse({ error: err.message });
    } finally {
      setIsTesting(false);
    }
  };

  // Format chart data (reverse so time goes left to right: 40m ago -> 0m ago)
  const chartData = selectedServicio?.historial_metricas
    ? [...selectedServicio.historial_metricas].reverse().map((p) => ({
        name: p.minutos_atras === 0 ? "Ahora" : `-${p.minutos_atras}m`,
        minutos: p.minutos_atras,
        "Tasa Error (%)": p.tasa_error_pct,
        "Latencia p95 (ms)": p.latencia_p95_ms,
        "CPU (%)": p.cpu_pct
      }))
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3" />
        <span>Cargando servicios de monitoreo...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Servicio de Monitoreo e Historial de Métricas</h2>
              <p className="text-xs text-slate-400">
                API HTTP real (<code className="text-indigo-300">GET /api/v1/monitoreo/historial</code>) que consulta el agente para correlación de incidentes.
              </p>
            </div>
          </div>

          {/* Service switcher tabs */}
          <div className="flex space-x-2 bg-slate-950 p-1 rounded-lg border border-slate-800">
            {servicios.map((s) => (
              <button
                key={s.servicio}
                onClick={() => setSelectedServicioName(s.servicio)}
                className={`px-3 py-1.5 rounded text-xs font-semibold transition ${
                  selectedServicioName === s.servicio
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {s.servicio}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Charts & Service Details */}
      {selectedServicio && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Charts (2 Cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Error Rate & Latency Chart */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-md">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <TrendingUp className="w-4 h-4 text-red-400" />
                    <span>Tasa de Error (%) y Latencia p95 (ms)</span>
                  </h3>
                  <p className="text-xs text-slate-400">Evolución en los últimos 40 minutos</p>
                </div>
                <span className="text-xs font-mono bg-slate-950 px-2 py-1 rounded text-slate-300 border border-slate-800">
                  {selectedServicio.servicio}
                </span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#090d16", borderColor: "#334155", borderRadius: "8px", fontSize: "12px" }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <Line
                      type="monotone"
                      dataKey="Tasa Error (%)"
                      stroke="#ef4444"
                      strokeWidth={2.5}
                      dot={{ fill: "#ef4444", r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Latencia p95 (ms)"
                      stroke="#38bdf8"
                      strokeWidth={2}
                      dot={{ fill: "#38bdf8", r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* CPU Chart */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-md">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <Activity className="w-4 h-4 text-indigo-400" />
                    <span>Uso de CPU (%)</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    {selectedServicio.servicio === "payments-db"
                      ? "Oscilación cíclica 55% - 85% por job de VACUUM programado"
                      : "Uso de CPU en réplicas"}
                  </p>
                </div>
              </div>

              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                    <YAxis domain={[0, 100]} stroke="#64748b" fontSize={11} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#090d16", borderColor: "#334155", borderRadius: "8px", fontSize: "12px" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="CPU (%)"
                      stroke="#818cf8"
                      fill="#818cf8"
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Service Details & Deploy Log (1 Col) */}
          <div className="space-y-6">
            {/* Overview Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-md space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Server className="w-4 h-4 text-blue-400" />
                <span>Detalles del Servicio</span>
              </h3>
              <p className="text-xs text-slate-300 bg-slate-950 p-3 rounded-lg border border-slate-800">
                {selectedServicio.descripcion}
              </p>

              {/* Historical Notes */}
              {selectedServicio.nota_historica && (
                <div className="bg-amber-950/30 border border-amber-800/40 rounded-lg p-3 text-xs space-y-1">
                  <span className="font-bold text-amber-300 flex items-center space-x-1.5">
                    <Shield className="w-3.5 h-3.5" />
                    <span>Nota Histórica Conocida (INFRA-1190)</span>
                  </span>
                  <p className="text-slate-300 leading-relaxed">{selectedServicio.nota_historica}</p>
                </div>
              )}

              {/* Recent Deploys / Incidents */}
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Deploys / Incidentes Recientes
                </span>
                {selectedServicio.incidentes_recientes.length > 0 ? (
                  <div className="space-y-2">
                    {selectedServicio.incidentes_recientes.map((inc) => (
                      <div
                        key={inc.id}
                        className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-amber-400 font-mono">{inc.id}</span>
                          <span className="text-slate-500 text-[10px]">Hace {inc.minutos_atras} min</span>
                        </div>
                        <h5 className="font-semibold text-slate-200">{inc.titulo}</h5>
                        <p className="text-slate-400 text-[11px]">{inc.detalle}</p>
                        <div className="text-[10px] text-slate-500 font-mono pt-1">Autor: {inc.autor}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs text-slate-500 italic">
                    Sin incidentes ni deploys en la ventana de tiempo.
                  </div>
                )}
              </div>
            </div>

            {/* Live API Tester */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-md">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2 mb-3">
                <FileCode2 className="w-4 h-4 text-emerald-400" />
                <span>Tester de API HTTP de Monitoreo</span>
              </h3>

              <form onSubmit={handleTestApi} className="space-y-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Nombre de Servicio</label>
                  <input
                    type="text"
                    value={testServicio}
                    onChange={(e) => setTestServicio(e.target.value)}
                    placeholder="checkout-api, payments-db, checkout-worker..."
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Ventana Minutos (5 - 180)</label>
                  <input
                    type="number"
                    min={5}
                    max={180}
                    value={testVentana}
                    onChange={(e) => setTestVentana(parseInt(e.target.value, 10) || 30)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isTesting}
                  className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded transition flex items-center justify-center space-x-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Probar GET Endpoint</span>
                </button>
              </form>

              {testStatus !== null && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">HTTP Status:</span>
                    <span
                      className={`px-2 py-0.5 rounded font-bold ${
                        testStatus === 200
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : testStatus === 404
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : "bg-red-500/20 text-red-400 border border-red-500/30"
                      }`}
                    >
                      {testStatus} {testStatus === 200 ? "OK" : testStatus === 404 ? "NOT FOUND" : "ERROR"}
                    </span>
                  </div>
                  <pre className="text-[11px] font-mono text-slate-300 bg-slate-950 p-2.5 rounded border border-slate-800 max-h-36 overflow-y-auto">
                    {JSON.stringify(testResponse, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
