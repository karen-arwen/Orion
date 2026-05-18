import { useState } from "react";
import { ModuleShell } from "../../components/layout/ModuleShell.js";
import {
  useCreateHabit,
  useDeleteHabit,
  useHabits,
  useToggleHabit,
} from "../../hooks/modules/useHabits.js";

const PRIMARY = "#10B981";

const COLOR_OPTIONS = ["#00D4FF", "#7C3AED", "#10B981", "#F59E0B", "#EC4899", "#EF4444"];
const ICON_OPTIONS = ["✓", "♡", "◉", "◐", "☽", "✦", "▷", "↑"];

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function HabitsPage(): JSX.Element {
  const { data: habits, isLoading } = useHabits();
  const create = useCreateHabit();
  const toggle = useToggleHabit();
  const remove = useDeleteHabit();

  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#00D4FF");
  const [newIcon, setNewIcon] = useState("✓");

  const handleCreate = (): void => {
    if (!newName.trim()) return;
    create.mutate(
      { name: newName.trim(), color: newColor, icon: newIcon },
      {
        onSuccess: () => {
          setNewName("");
          setShowForm(false);
        },
      },
    );
  };

  // Grid de 30 dias (mais antigo à esquerda, hoje à direita)
  const dayGrid: string[] = [];
  for (let i = 29; i >= 0; i--) dayGrid.push(isoDaysAgo(i));

  return (
    <ModuleShell icon="✓" label="HÁBITOS" sub="Streak · Tracking · Coach" color={PRIMARY}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Toolbar */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <button
            onClick={() => setShowForm((p) => !p)}
            className="hud-label"
            style={{
              padding: "8px 14px",
              fontSize: 10,
              background: showForm ? `${PRIMARY}25` : "rgba(255,255,255,0.02)",
              border: `1px solid ${showForm ? PRIMARY : "rgba(255,255,255,0.1)"}`,
              color: showForm ? PRIMARY : "rgba(255,255,255,0.4)",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            {showForm ? "× FECHAR" : "+ NOVO HÁBITO"}
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div
            style={{
              padding: 16,
              marginBottom: 20,
              background: "rgba(255,255,255,0.02)",
              border: `1px solid ${PRIMARY}30`,
              borderRadius: 10,
            }}
          >
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Nome do hábito (ex: 'meditar 10min')"
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
                marginBottom: 12,
              }}
            />
            <div style={{ display: "flex", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
              <div>
                <div
                  className="hud-label"
                  style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}
                >
                  COR
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewColor(c)}
                      style={{
                        width: 24,
                        height: 24,
                        background: c,
                        border: newColor === c ? "2px solid #fff" : "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 4,
                        cursor: "pointer",
                      }}
                    />
                  ))}
                </div>
              </div>
              <div>
                <div
                  className="hud-label"
                  style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}
                >
                  ÍCONE
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  {ICON_OPTIONS.map((i) => (
                    <button
                      key={i}
                      onClick={() => setNewIcon(i)}
                      style={{
                        width: 24,
                        height: 24,
                        fontSize: 14,
                        background: newIcon === i ? `${newColor}30` : "rgba(255,255,255,0.04)",
                        border: `1px solid ${newIcon === i ? newColor : "rgba(255,255,255,0.1)"}`,
                        color: newIcon === i ? newColor : "rgba(255,255,255,0.5)",
                        borderRadius: 4,
                        cursor: "pointer",
                      }}
                    >
                      {i}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || create.isPending}
              className="hud-label"
              style={{
                padding: "8px 14px",
                fontSize: 10,
                background: `${newColor}25`,
                border: `1px solid ${newColor}`,
                color: newColor,
                borderRadius: 6,
                cursor: newName.trim() ? "pointer" : "not-allowed",
                opacity: newName.trim() ? 1 : 0.4,
              }}
            >
              {create.isPending ? "CRIANDO…" : "+ CRIAR"}
            </button>
          </div>
        )}

        {isLoading && (
          <div
            className="hud-label"
            style={{ color: "rgba(255,255,255,0.3)", padding: 40, textAlign: "center" }}
          >
            ◌ carregando…
          </div>
        )}

        {habits && habits.length === 0 && !isLoading && (
          <div
            style={{
              padding: 30,
              background: "rgba(255,255,255,0.015)",
              border: "1px dashed rgba(16,185,129,0.3)",
              borderRadius: 10,
              textAlign: "center",
              fontSize: 12,
              color: "rgba(255,255,255,0.4)",
            }}
          >
            Você ainda não tem hábitos. Cria o primeiro acima — meditação, leitura, exercício, água…
          </div>
        )}

        {/* List */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {(habits ?? []).map((h) => {
            const todayStr = isoDaysAgo(0);
            const doneToday = h.recentLogs[todayStr] ?? false;
            return (
              <div
                key={h.id}
                style={{
                  padding: 14,
                  background: "rgba(255,255,255,0.02)",
                  border: `1px solid ${h.color}30`,
                  borderLeft: `3px solid ${h.color}`,
                  borderRadius: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <span style={{ fontSize: 22, color: h.color }}>{h.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}
                    >
                      {h.name}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "rgba(255,255,255,0.35)",
                        fontFamily: "'Share Tech Mono', monospace",
                      }}
                    >
                      streak {h.streak} dias · recorde {h.bestStreak}
                    </div>
                  </div>
                  <button
                    onClick={() => toggle.mutate(h.id)}
                    disabled={toggle.isPending}
                    className="hud-label"
                    style={{
                      padding: "6px 14px",
                      fontSize: 10,
                      background: doneToday ? `${h.color}30` : "rgba(255,255,255,0.04)",
                      border: `1px solid ${doneToday ? h.color : "rgba(255,255,255,0.15)"}`,
                      color: doneToday ? h.color : "rgba(255,255,255,0.5)",
                      borderRadius: 5,
                      cursor: "pointer",
                    }}
                  >
                    {doneToday ? "✓ HOJE" : "MARCAR HOJE"}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Apagar o hábito "${h.name}"?`)) remove.mutate(h.id);
                    }}
                    style={{
                      padding: "6px 8px",
                      fontSize: 11,
                      background: "transparent",
                      border: "1px solid rgba(239,68,68,0.3)",
                      color: "rgba(239,68,68,0.7)",
                      borderRadius: 4,
                      cursor: "pointer",
                    }}
                  >
                    ×
                  </button>
                </div>

                {/* Heatmap 30 dias */}
                <div style={{ display: "flex", gap: 3 }}>
                  {dayGrid.map((d) => {
                    const done = h.recentLogs[d] ?? false;
                    return (
                      <div
                        key={d}
                        title={`${d}${done ? " · feito" : ""}`}
                        style={{
                          flex: 1,
                          height: 18,
                          background: done ? h.color : "rgba(255,255,255,0.04)",
                          borderRadius: 2,
                          opacity: done ? 1 : 0.5,
                        }}
                      />
                    );
                  })}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 9,
                    color: "rgba(255,255,255,0.25)",
                    fontFamily: "'Share Tech Mono', monospace",
                    marginTop: 3,
                  }}
                >
                  <span>30 dias atrás</span>
                  <span>hoje</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ModuleShell>
  );
}
