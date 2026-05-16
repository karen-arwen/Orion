import { useState, type KeyboardEvent } from "react";
import type { LessonMaterial, LessonSession } from "@orion/types";
import { ModuleShell } from "../../components/layout/ModuleShell.js";
import {
  useAskTutor,
  useContinueLesson,
  useDeleteLesson,
  useLesson,
  useLessons,
} from "../../hooks/modules/useKnow.js";

type Depth = "rapido" | "padrao" | "fundo";
type Mode = "ask" | "lessons";

interface QA {
  q: string;
  a: string;
  depth: Depth;
}

const DEPTHS: Array<{ id: Depth; label: string }> = [
  { id: "rapido", label: "RÁPIDO" },
  { id: "padrao", label: "PADRÃO" },
  { id: "fundo", label: "FUNDO" },
];

const PRIMARY = "#00D4FF";

export function KnowPage(): JSX.Element {
  const [mode, setMode] = useState<Mode>("ask");
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);

  return (
    <ModuleShell icon="◉" label="CONHECIMENTO" sub="Tutor · Expert · Professor" color={PRIMARY}>
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        {/* Tab switcher */}
        <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
          {(["ask", "lessons"] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setActiveLessonId(null);
              }}
              className="hud-label"
              style={{
                padding: "8px 14px",
                fontSize: 10,
                background: mode === m ? `${PRIMARY}18` : "transparent",
                border: `1px solid ${mode === m ? PRIMARY : "rgba(255,255,255,0.1)"}`,
                color: mode === m ? PRIMARY : "rgba(255,255,255,0.4)",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              {m === "ask" ? "◈ PERGUNTAR" : "▤ MINHAS AULAS"}
            </button>
          ))}
        </div>

        {mode === "ask" && <AskMode />}
        {mode === "lessons" && (
          <LessonsMode activeId={activeLessonId} onSelect={setActiveLessonId} />
        )}
      </div>
    </ModuleShell>
  );
}

// ── ASK MODE ────────────────────────────────────────────────────────

function AskMode(): JSX.Element {
  const [question, setQuestion] = useState("");
  const [depth, setDepth] = useState<Depth>("padrao");
  const [history, setHistory] = useState<QA[]>([]);
  const [recentLesson, setRecentLesson] = useState<LessonSession | null>(null);
  const ask = useAskTutor();

  const handleAsk = (): void => {
    const q = question.trim();
    if (!q || ask.isPending) return;
    setQuestion("");
    ask.mutate(
      { question: q, depth },
      {
        onSuccess: (data) => {
          if (data.kind === "lesson") {
            setRecentLesson(data.lesson);
          } else {
            setHistory((h) => [{ q, a: data.answer, depth }, ...h]);
          }
        },
      },
    );
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleAsk();
    }
  };

  return (
    <>
      {/* Input */}
      <div
        style={{
          padding: 16,
          marginBottom: 24,
          background: "rgba(255,255,255,0.02)",
          border: `1px solid ${PRIMARY}30`,
          borderRadius: 10,
        }}
      >
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKey}
          placeholder='Pergunte… ou peça "monta uma aula sobre [tópico]" pra material estruturado'
          rows={3}
          style={{
            width: "100%",
            padding: "10px 12px",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 6,
            color: "#fff",
            fontSize: 13,
            fontFamily: "'Rajdhani', sans-serif",
            outline: "none",
            resize: "vertical",
            marginBottom: 10,
          }}
        />
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span className="hud-label" style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>
            PROFUNDIDADE:
          </span>
          {DEPTHS.map((d) => (
            <button
              key={d.id}
              onClick={() => setDepth(d.id)}
              className="hud-label"
              style={{
                padding: "4px 10px",
                fontSize: 9,
                background: depth === d.id ? `${PRIMARY}20` : "transparent",
                border: `1px solid ${PRIMARY}40`,
                color: depth === d.id ? PRIMARY : "rgba(255,255,255,0.4)",
                borderRadius: 5,
                cursor: "pointer",
              }}
            >
              {d.label}
            </button>
          ))}
          <button
            onClick={handleAsk}
            disabled={!question.trim() || ask.isPending}
            className="hud-label"
            style={{
              marginLeft: "auto",
              padding: "6px 14px",
              fontSize: 10,
              background: `${PRIMARY}25`,
              border: `1px solid ${PRIMARY}`,
              color: PRIMARY,
              borderRadius: 6,
              cursor: question.trim() ? "pointer" : "not-allowed",
              opacity: question.trim() ? 1 : 0.4,
            }}
          >
            {ask.isPending ? "PENSANDO…" : "▶ PERGUNTAR  (Ctrl+Enter)"}
          </button>
        </div>
      </div>

      {/* Recent lesson (se foi criada) */}
      {recentLesson && (
        <div style={{ marginBottom: 24 }}>
          <div
            className="hud-label"
            style={{ fontSize: 10, color: PRIMARY, marginBottom: 10 }}
          >
            ✦ AULA GERADA — {recentLesson.topic}
          </div>
          <LessonMaterialView material={recentLesson.material} />
        </div>
      )}

      {/* Q&A history */}
      {history.length === 0 && !ask.isPending && !recentLesson && (
        <div
          className="hud-label"
          style={{ color: "rgba(255,255,255,0.25)", textAlign: "center", padding: 40 }}
        >
          Pergunte algo… ou peça uma aula.
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {history.map((qa, i) => (
          <div key={i}>
            <div
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.5)",
                marginBottom: 8,
                paddingLeft: 12,
                borderLeft: "2px solid rgba(255,255,255,0.15)",
              }}
            >
              {qa.q}
            </div>
            <div
              style={{
                padding: 16,
                background: `${PRIMARY}0a`,
                border: `1px solid ${PRIMARY}30`,
                borderRadius: 8,
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: 12,
                color: "rgba(255,255,255,0.85)",
                lineHeight: 1.7,
                whiteSpace: "pre-wrap",
              }}
            >
              {qa.a}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ── LESSONS MODE ────────────────────────────────────────────────────

function LessonsMode({
  activeId,
  onSelect,
}: {
  activeId: string | null;
  onSelect: (id: string | null) => void;
}): JSX.Element {
  const { data: lessons, isLoading } = useLessons();
  const remove = useDeleteLesson();

  if (activeId) return <LessonDetail id={activeId} onBack={() => onSelect(null)} />;

  return (
    <div>
      {isLoading && (
        <div className="hud-label" style={{ color: "rgba(255,255,255,0.4)", padding: 40, textAlign: "center" }}>
          ◌ carregando aulas…
        </div>
      )}
      {lessons && lessons.length === 0 && (
        <div
          className="hud-label"
          style={{ color: "rgba(255,255,255,0.25)", textAlign: "center", padding: 40 }}
        >
          Nenhuma aula ainda. Vá na aba PERGUNTAR e peça "monta uma aula sobre X".
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {(lessons ?? []).map((l) => (
          <div
            key={l.id}
            style={{
              padding: 14,
              background: "rgba(255,255,255,0.02)",
              border: `1px solid ${PRIMARY}20`,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div style={{ flex: 1, cursor: "pointer" }} onClick={() => onSelect(l.id)}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.9)", marginBottom: 4 }}>
                {l.topic}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: 9,
                  color: "rgba(255,255,255,0.3)",
                  flexWrap: "wrap",
                }}
              >
                <span style={{ color: PRIMARY }}>[{l.level.toUpperCase()}]</span>
                <span>·</span>
                <span>{new Date(l.createdAt).toLocaleDateString("pt-BR")}</span>
                {l.tags.length > 0 && (
                  <>
                    <span>·</span>
                    <span>{l.tags.map((t) => `#${t}`).join(" ")}</span>
                  </>
                )}
              </div>
            </div>
            <button
              onClick={() => onSelect(l.id)}
              className="hud-label"
              style={{
                padding: "6px 10px",
                fontSize: 9,
                background: `${PRIMARY}15`,
                border: `1px solid ${PRIMARY}40`,
                color: PRIMARY,
                borderRadius: 5,
                cursor: "pointer",
              }}
            >
              ABRIR
            </button>
            <button
              onClick={() => {
                if (confirm(`Apagar a aula sobre "${l.topic}"?`)) remove.mutate(l.id);
              }}
              className="hud-label"
              style={{
                padding: "6px 8px",
                fontSize: 9,
                background: "transparent",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "rgba(239,68,68,0.7)",
                borderRadius: 5,
                cursor: "pointer",
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function LessonDetail({ id, onBack }: { id: string; onBack: () => void }): JSX.Element {
  const { data: lesson, isLoading } = useLesson(id);
  const cont = useContinueLesson();
  const [question, setQuestion] = useState("");

  if (isLoading || !lesson) {
    return (
      <div className="hud-label" style={{ color: "rgba(255,255,255,0.4)", padding: 40, textAlign: "center" }}>
        ◌ carregando aula…
      </div>
    );
  }

  const handleAsk = (): void => {
    const q = question.trim();
    if (!q || cont.isPending) return;
    setQuestion("");
    cont.mutate({ id, question: q });
  };

  return (
    <div>
      <button
        onClick={onBack}
        className="hud-label"
        style={{
          padding: "6px 12px",
          fontSize: 10,
          background: "transparent",
          border: `1px solid ${PRIMARY}30`,
          color: `${PRIMARY}aa`,
          borderRadius: 6,
          cursor: "pointer",
          marginBottom: 18,
        }}
      >
        ← LISTA
      </button>

      <div style={{ marginBottom: 24 }}>
        <div className="hud-label" style={{ fontSize: 9, color: PRIMARY, marginBottom: 4 }}>
          AULA · {lesson.level.toUpperCase()}
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "rgba(255,255,255,0.95)" }}>
          {lesson.topic}
        </div>
      </div>

      <LessonMaterialView material={lesson.material} />

      {/* Histórico de Q&A da aula */}
      {lesson.messages.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <div className="hud-label" style={{ fontSize: 10, color: PRIMARY, marginBottom: 14 }}>
            DÚVIDAS APROFUNDADAS
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {lesson.messages.map((m) => (
              <div
                key={m.id}
                style={{
                  padding: m.role === "user" ? "8px 12px" : "14px",
                  background: m.role === "user" ? "rgba(255,255,255,0.04)" : `${PRIMARY}0a`,
                  border: `1px solid ${m.role === "user" ? "rgba(255,255,255,0.08)" : `${PRIMARY}25`}`,
                  borderLeft: m.role === "user" ? "2px solid rgba(255,255,255,0.2)" : `3px solid ${PRIMARY}`,
                  borderRadius: 6,
                  fontFamily: m.role === "user" ? "'Rajdhani', sans-serif" : "'Share Tech Mono', monospace",
                  fontSize: m.role === "user" ? 13 : 12,
                  color: "rgba(255,255,255,0.85)",
                  lineHeight: 1.7,
                  whiteSpace: "pre-wrap",
                }}
              >
                {m.content}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Continue input */}
      <div
        style={{
          marginTop: 24,
          padding: 14,
          background: "rgba(255,255,255,0.02)",
          border: `1px solid ${PRIMARY}25`,
          borderRadius: 8,
        }}
      >
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Pergunte algo sobre essa aula…"
          rows={2}
          style={{
            width: "100%",
            padding: "8px 10px",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 6,
            color: "#fff",
            fontSize: 13,
            fontFamily: "'Rajdhani', sans-serif",
            outline: "none",
            resize: "vertical",
            marginBottom: 8,
          }}
        />
        <button
          onClick={handleAsk}
          disabled={!question.trim() || cont.isPending}
          className="hud-label"
          style={{
            padding: "6px 12px",
            fontSize: 10,
            background: `${PRIMARY}25`,
            border: `1px solid ${PRIMARY}`,
            color: PRIMARY,
            borderRadius: 6,
            cursor: question.trim() ? "pointer" : "not-allowed",
            opacity: question.trim() ? 1 : 0.4,
          }}
        >
          {cont.isPending ? "PENSANDO…" : "▶ APROFUNDAR"}
        </button>
      </div>
    </div>
  );
}

// ── COMPONENTE: material estruturado ────────────────────────────────

function LessonMaterialView({ material }: { material: LessonMaterial }): JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Block title="OBJETIVOS" color={PRIMARY}>
        <ul style={{ paddingLeft: 16, margin: 0 }}>
          {material.objectives.map((o, i) => (
            <li key={i} style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", lineHeight: 1.7, marginBottom: 4 }}>
              {o}
            </li>
          ))}
        </ul>
      </Block>

      <Block title="TÓPICOS" color="#7C3AED">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {material.topics.map((t, i) => (
            <div key={i}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#7C3AED", marginBottom: 4 }}>
                {i + 1}. {t.title}
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", lineHeight: 1.7 }}>
                {t.explanation}
              </div>
            </div>
          ))}
        </div>
      </Block>

      {material.examples.length > 0 && (
        <Block title="EXEMPLOS" color="#10B981">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {material.examples.map((e, i) => (
              <div key={i}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#10B981", marginBottom: 3 }}>
                  ◉ {e.title}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", lineHeight: 1.7 }}>
                  {e.body}
                </div>
              </div>
            ))}
          </div>
        </Block>
      )}

      {material.exercises.length > 0 && (
        <Block title="EXERCÍCIOS" color="#F59E0B">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {material.exercises.map((ex, i) => (
              <details
                key={i}
                style={{
                  padding: 10,
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(245,158,11,0.2)",
                  borderRadius: 6,
                }}
              >
                <summary
                  style={{
                    cursor: "pointer",
                    fontSize: 12,
                    color: "rgba(255,255,255,0.85)",
                    lineHeight: 1.6,
                  }}
                >
                  <strong style={{ color: "#F59E0B" }}>{i + 1}.</strong> {ex.prompt}
                </summary>
                {ex.hint && (
                  <div style={{ marginTop: 6, fontSize: 11, color: "rgba(255,255,255,0.5)", fontStyle: "italic" }}>
                    Dica: {ex.hint}
                  </div>
                )}
                {ex.answer && (
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 11,
                      color: "#10B981",
                      fontFamily: "'Share Tech Mono', monospace",
                    }}
                  >
                    Resposta: {ex.answer}
                  </div>
                )}
              </details>
            ))}
          </div>
        </Block>
      )}

      {material.next.length > 0 && (
        <Block title="PRÓXIMOS PASSOS" color="#EC4899">
          <ul style={{ paddingLeft: 16, margin: 0 }}>
            {material.next.map((n, i) => (
              <li key={i} style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", lineHeight: 1.7, marginBottom: 4 }}>
                {n}
              </li>
            ))}
          </ul>
        </Block>
      )}
    </div>
  );
}

function Block({
  title,
  color,
  children,
}: {
  title: string;
  color: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div
      style={{
        padding: 14,
        background: "rgba(255,255,255,0.015)",
        border: `1px solid ${color}25`,
        borderRadius: 8,
      }}
    >
      <div className="hud-label" style={{ fontSize: 10, color, marginBottom: 10, letterSpacing: "0.2em" }}>
        ▸ {title}
      </div>
      {children}
    </div>
  );
}
