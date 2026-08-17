import { useBehavioralProfile, useAnalyzeBehavioralProfile } from "../hooks/useBehavioralProfile.js";
import type { BehavioralProfileResult } from "../lib/api.js";

/* ═══════════════════════════════════════════════════════════════════
   BEHAVIORAL PROFILE PAGE — como o ORION aprendeu a te conhecer.

   Mostra o perfil comportamental detectado automaticamente e permite
   o usuário entender e validar o que o ORION aprendeu sobre ele.
═══════════════════════════════════════════════════════════════════ */

const PRIMARY = "#00D4FF";
const BG = "#030509";
const SURFACE = "#0a0f1a";
const BORDER = "#00D4FF18";

const STYLE_LABELS = {
  direct:    { label: "DIRETO",     desc: "Vai ao ponto, frases curtas, sem rodeios" },
  elaborate: { label: "ELABORADO",  desc: "Explica bastante, contexto rico, detalhado" },
  casual:    { label: "CASUAL",     desc: "Descontraído, gírias, tom de conversa" },
  formal:    { label: "FORMAL",     desc: "Formal, profissional, educado" },
  unknown:   { label: "DESCONHECIDO", desc: "Ainda analisando..." },
};

const LENGTH_LABELS = {
  short:    { label: "CURTO",     desc: "Prefere respostas concisas e diretas" },
  medium:   { label: "MÉDIO",     desc: "Equilíbrio entre completude e brevidade" },
  detailed: { label: "DETALHADO", desc: "Quer explicação completa com contexto" },
  unknown:  { label: "VARIÁVEL",  desc: "Depende do assunto" },
};

const TECH_LABELS = {
  beginner:     { label: "INICIANTE",     desc: "Prefere analogias e linguagem acessível" },
  intermediate: { label: "INTERMEDIÁRIO", desc: "Conhecimento técnico moderado" },
  expert:       { label: "EXPERT",        desc: "Vocabulário técnico avançado, pula básico" },
  unknown:      { label: "VARIÁVEL",      desc: "Ainda calibrando..." },
};

const OPENNESS_LABELS = {
  low:    { label: "OBJETIVO",      desc: "Foco em tarefas, pouco contexto pessoal" },
  medium: { label: "EQUILIBRADO",   desc: "Mistura objetivos e contexto pessoal" },
  high:   { label: "ABERTO",        desc: "Compartilha sentimentos e contexto pessoal" },
  unknown: { label: "VARIÁVEL",     desc: "Ainda calibrando..." },
};

function ConfidenceBar({ value }: { value: number }): JSX.Element {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? "#10B981" : pct >= 40 ? "#F59E0B" : "#EF4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <div style={{ flex: 1, height: "4px", background: "#1F2937", borderRadius: "2px", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width 0.5s ease", borderRadius: "2px" }} />
      </div>
      <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "11px", color, minWidth: "32px" }}>
        {pct}%
      </span>
    </div>
  );
}

interface ProfileDimensionProps {
  label: string;
  value: string;
  meta: { label: string; desc: string };
  icon: string;
  color?: string;
}

function ProfileDimension({ label, value, meta, icon, color = PRIMARY }: ProfileDimensionProps): JSX.Element {
  const isUnknown = value === "unknown";
  return (
    <div style={{
      background: SURFACE,
      border: `1px solid ${isUnknown ? "#1F2937" : BORDER}`,
      borderLeft: `3px solid ${isUnknown ? "#374151" : color}`,
      borderRadius: "4px",
      padding: "14px 16px",
      opacity: isUnknown ? 0.5 : 1,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
        <span style={{ fontSize: "14px" }}>{icon}</span>
        <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "9px", color: "#4B5563", letterSpacing: "0.1em" }}>
          {label}
        </span>
      </div>
      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "14px", color: isUnknown ? "#374151" : color, letterSpacing: "0.08em", marginBottom: "4px" }}>
        {meta.label}
      </div>
      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "10px", color: "#6B7280", lineHeight: 1.5 }}>
        {meta.desc}
      </div>
    </div>
  );
}

function EmptyState({ onAnalyze, loading }: { onAnalyze: () => void; loading: boolean }): JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", gap: "20px" }}>
      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "32px", color: "#1F2937" }}>◌</div>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "13px", color: "#6B7280", marginBottom: "6px", letterSpacing: "0.05em" }}>
          Perfil comportamental ainda não analisado
        </p>
        <p style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "10px", color: "#374151", letterSpacing: "0.04em" }}>
          O ORION analisa suas conversas e aprende como você se comunica
        </p>
      </div>
      <button onClick={onAnalyze} disabled={loading} style={analyzeButtonStyle(loading)}>
        {loading ? "ANALISANDO..." : "INICIAR ANÁLISE"}
      </button>
    </div>
  );
}

function analyzeButtonStyle(loading: boolean): React.CSSProperties {
  return {
    padding: "8px 20px",
    border: `1px solid ${loading ? "#374151" : `${PRIMARY}60`}`,
    borderRadius: "3px",
    background: loading ? "transparent" : `${PRIMARY}12`,
    color: loading ? "#374151" : PRIMARY,
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: "11px",
    letterSpacing: "0.1em",
    cursor: loading ? "not-allowed" : "pointer",
    transition: "all 0.2s",
  };
}

function ProfileCard({ profile, onReanalyze, loading }: {
  profile: BehavioralProfileResult;
  onReanalyze: () => void;
  loading: boolean;
}): JSX.Element {
  const analyzedDate = profile.analyzedAt
    ? new Date(profile.analyzedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <div>
      {/* Header com confiança */}
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "4px", padding: "16px 20px", marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
          <div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "11px", color: "#4B5563", letterSpacing: "0.1em", marginBottom: "4px" }}>
              PERFIL APRENDIDO · {profile.basedOnMessages} MENSAGENS ANALISADAS
            </div>
            {profile.primaryLanguageTone && (
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "15px", color: PRIMARY, letterSpacing: "0.06em" }}>
                "{profile.primaryLanguageTone}"
              </div>
            )}
          </div>
          <button onClick={onReanalyze} disabled={loading} style={{ ...analyzeButtonStyle(loading), padding: "5px 14px", fontSize: "9px" }}>
            {loading ? "..." : "RE-ANALISAR"}
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "10px", color: "#4B5563", letterSpacing: "0.08em" }}>
              CONFIANÇA NA ANÁLISE
            </span>
            <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "9px", color: "#374151" }}>
              {analyzedDate}
            </span>
          </div>
          <ConfidenceBar value={profile.confidence} />
          {profile.confidence < 0.5 && (
            <p style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "10px", color: "#F59E0B", marginTop: "6px", letterSpacing: "0.04em" }}>
              ⚠ Converse mais com o ORION para melhorar a precisão
            </p>
          )}
        </div>

        {/* Humor flag */}
        {profile.usesHumor && (
          <div style={{ marginTop: "12px", display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 10px", border: `1px solid #F59E0B40`, borderRadius: "2px", background: "#F59E0B08" }}>
            <span style={{ fontSize: "11px" }}>◎</span>
            <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "10px", color: "#F59E0B", letterSpacing: "0.06em" }}>
              HUMOR DETECTADO — o ORION pode responder na mesma frequência
            </span>
          </div>
        )}
      </div>

      {/* Dimensões */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        <ProfileDimension
          label="ESTILO DE COMUNICAÇÃO"
          value={profile.communicationStyle}
          meta={STYLE_LABELS[profile.communicationStyle]}
          icon="◈"
          color={PRIMARY}
        />
        <ProfileDimension
          label="TAMANHO DE RESPOSTA"
          value={profile.preferredResponseLength}
          meta={LENGTH_LABELS[profile.preferredResponseLength]}
          icon="◎"
          color="#818CF8"
        />
        <ProfileDimension
          label="NÍVEL TÉCNICO"
          value={profile.technicalLevel}
          meta={TECH_LABELS[profile.technicalLevel]}
          icon="◉"
          color="#10B981"
        />
        <ProfileDimension
          label="ABERTURA EMOCIONAL"
          value={profile.emotionalOpenness}
          meta={OPENNESS_LABELS[profile.emotionalOpenness]}
          icon="◌"
          color="#F59E0B"
        />
      </div>

      {/* Explicação */}
      <div style={{ marginTop: "20px", background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "4px", padding: "14px 16px" }}>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "9px", color: "#374151", letterSpacing: "0.12em", marginBottom: "8px" }}>
          COMO ISSO É USADO
        </div>
        <p style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "10px", color: "#6B7280", lineHeight: 1.7, margin: 0, letterSpacing: "0.03em" }}>
          O ORION usa esse perfil para adaptar o tom de cada resposta automaticamente.
          Se você é direto, ele vai direto. Se é casual, ele relaxa. Se é expert, ele
          pula os básicos. Quanto mais você conversa, mais preciso fica.
        </p>
      </div>
    </div>
  );
}

export function BehavioralProfilePage(): JSX.Element {
  const { data: profile, isLoading: profileLoading } = useBehavioralProfile();
  const { mutate: analyze, isPending: analyzing } = useAnalyzeBehavioralProfile();

  const loading = profileLoading || analyzing;

  return (
    <div style={{ background: BG, minHeight: "100%", padding: "28px 32px", color: "#E2E8F0", maxWidth: "720px" }}>
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "12px", marginBottom: "6px" }}>
          <h1 style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "18px", letterSpacing: "0.15em", color: PRIMARY, margin: 0 }}>
            PERFIL ADAPTATIVO
          </h1>
          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "10px", color: "#374151", letterSpacing: "0.1em" }}>
            COMO O ORION APRENDEU A TE CONHECER
          </span>
        </div>
        <p style={{ color: "#4B5563", fontSize: "11px", fontFamily: "'Share Tech Mono', monospace", margin: 0, letterSpacing: "0.04em" }}>
          Analisado automaticamente a partir das suas conversas. Atualiza com o tempo.
        </p>
      </div>

      {profileLoading ? (
        <div style={{ color: "#374151", fontFamily: "'Share Tech Mono', monospace", fontSize: "11px", padding: "40px 0", textAlign: "center" }}>
          CARREGANDO PERFIL...
        </div>
      ) : profile ? (
        <ProfileCard profile={profile} onReanalyze={() => analyze()} loading={analyzing} />
      ) : (
        <EmptyState onAnalyze={() => analyze()} loading={analyzing} />
      )}
    </div>
  );
}
