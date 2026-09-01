export interface AlertaInput {
  alerta_id: string;
  servicio: string;
  metrica: string;
  valor_actual: number;
  umbral: number;
  timestamp: string;
}

export type Severidad = 'P1' | 'P2' | 'P3' | 'P4';
export type NivelAutonomia = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';

export interface Evidencia {
  metrica_actual: string;
  comparacion_historica: string;
  incidente_correlacionado: string | null;
  error_herramienta: string | null;
}

export interface TriageOutput {
  alerta_id: string;
  servicio: string;
  severidad: Severidad;
  confianza: number;
  causa_probable: string;
  sistemas_afectados: string[];
  evidencia: Evidencia;
  accion_recomendada: string;
  requiere_intervencion_humana: boolean;
  nivel_autonomia: NivelAutonomia;
  siguiente_paso: string;
}

export interface UsageCall {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
  thoughtsTokenCount?: number;
  serviceTier?: string;
}

export interface CorridaMetadata {
  proveedor: 'gemini' | 'anthropic' | 'local_agent';
  modelo: string;
  modo_generacion: 'automatico' | 'asistido';
  fecha_inicio_utc: string;
  fecha_fin_utc: string;
  usage_por_llamada?: UsageCall[];
  cantidad_llamadas_herramienta: number;
  stop_reason?: string;
}

export interface RevisionHumana {
  _nota?: string;
  corrida: string;
  revisor: string;
  rol: string;
  timestamp_revision_utc: string;
  triage_revisado: {
    severidad: string;
    accion_recomendada: string;
  };
  decision: string;
  decision_texto: string;
  accion_real_ejecutada: string;
}

export interface LlamadaHerramienta {
  input: {
    servicio: string;
    ventana_minutos?: number;
  };
  resultado: {
    status: number;
    body: any;
  };
}

export interface CorridaCompleta {
  id: string;
  nombre: string;
  descripcion: string;
  input: AlertaInput;
  output: TriageOutput;
  llamadas: LlamadaHerramienta[];
  metadata: CorridaMetadata;
  revision_humana?: RevisionHumana | null;
  user_prompt_enviado?: string;
}

export interface MetricaPunto {
  minutos_atras: number;
  tasa_error_pct: number;
  latencia_p95_ms: number;
  cpu_pct: number;
}

export interface IncidenteReciente {
  id: string;
  tipo: string;
  minutos_atras: number;
  titulo: string;
  autor: string;
  detalle: string;
}

export interface ServicioDetalle {
  servicio: string;
  descripcion: string;
  historial_metricas: MetricaPunto[];
  incidentes_recientes: IncidenteReciente[];
  nota_historica?: string | null;
}

export interface TriageExecutionLog {
  timestamp: string;
  tipo: 'info' | 'tool_call' | 'tool_result' | 'llm_reasoning' | 'schema_validation' | 'decision';
  mensaje: string;
  datos?: any;
}
