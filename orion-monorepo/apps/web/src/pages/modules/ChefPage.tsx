import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ModuleShell } from "../../components/layout/ModuleShell.js";
import { ModuleChat } from "../../components/panels/ModuleChat.js";
import { useChefRecipe, useSavedRecipes, useSaveRecipe, useDeleteSavedRecipe } from "../../hooks/modules/useChef.js";
import { TimelineRail, type TimelineNode } from "../../components/visual/TimelineRail.js";
import { TagPill } from "../../components/visual/TagPill.js";

const PRIMARY = "#F59E0B";
const ACCENT = "#10B981";

const GOAL_OPTIONS = [
  { value: "rapido" as const,      label: "RAPIDO",      icon: "⚡", color: "#F59E0B" },
  { value: "saudavel" as const,    label: "SAUDAVEL",    icon: "♡",  color: "#10B981" },
  { value: "barato" as const,      label: "BARATO",      icon: "$",  color: "#7C3AED" },
  { value: "comfort" as const,     label: "COMFORT",     icon: "♨",  color: "#EC4899" },
  { value: "high_protein" as const,label: "HIGH PROTEIN",icon: "▲",  color: "#EF4444" },
];

const COMMON_INGREDIENTS = ["frango","arroz","ovos","tomate","cebola","alho","batata","queijo","macarrao","atum","feijao","carne moida","legumes"];

const QUICK_IDEAS = [
  { text: "Quero algo doce mas saudável",     icon: "🍰" },
  { text: "Preciso de um lanche rápido agora", icon: "⚡" },
  { text: "Jantar romântico pra dois",          icon: "❤" },
  { text: "Algo com o que sobrou na geladeira", icon: "🧊" },
  { text: "Receita fitness pós-treino",         icon: "💪" },
  { text: "Comfort food pra dia chuvoso",       icon: "♨" },
];

export function ChefPage(): JSX.Element {
  const recipe    = useChefRecipe();
  const saved     = useSavedRecipes();
  const saveR     = useSaveRecipe();
  const deleteR   = useDeleteSavedRecipe();

  const [ingredientInput, setIngredientInput] = useState("");
  const [ingredients, setIngredients] = useState<string[]>(["frango", "arroz", "ovos"]);
  const [goal, setGoal]               = useState<typeof GOAL_OPTIONS[number]["value"]>("rapido");
  const [servings, setServings]       = useState(2);
  const [restrictions, setRestrictions] = useState("");
  const [saveRating, setSaveRating]   = useState(0);
  const [saveNotes, setSaveNotes]     = useState("");
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [tab, setTab]                 = useState<"cook" | "saved">("cook");
  const [expandedId, setExpandedId]   = useState<string | null>(null);

  const savedList = saved.data ?? [];

  const addIngredient = (item: string): void => {
    const c = item.trim().toLowerCase();
    if (!c || ingredients.includes(c)) return;
    setIngredients((p) => [...p, c]);
    setIngredientInput("");
  };

  const run = (): void => {
    if (ingredients.length === 0) return;
    recipe.mutate({ ingredients, goal, servings, restrictions: restrictions.trim() || undefined });
    setShowSaveForm(false);
    setSaveRating(0);
    setSaveNotes("");
  };

  const handleSave = (): void => {
    if (!recipe.data || saveRating === 0) return;
    saveR.mutate({
      ...recipe.data,
      goal,
      rating: saveRating,
      notes: saveNotes.trim() || undefined,
    }, {
      onSuccess: () => { setShowSaveForm(false); setSaveRating(0); setSaveNotes(""); },
    });
  };

  const handleQuickIdea = (text: string): void => {
    recipe.mutate({ ingredients: ["qualquer"], goal: "rapido", servings, restrictions: text });
  };

  const currentGoal = GOAL_OPTIONS.find((g) => g.value === goal) ?? GOAL_OPTIONS[0]!;

  return (
    <ModuleShell icon="◍" label="CHEF" sub="Receitas inteligentes · compras · substituições" color={PRIMARY}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${PRIMARY}15`, paddingBottom: 2 }}>
          {([
            ["cook",  `🍳 COZINHAR`],
            ["saved", `⭐ COLEÇÃO (${savedList.length})`],
          ] as const).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className="hud-label" style={{ padding: "8px 16px", fontSize: 10, background: tab === id ? `${PRIMARY}15` : "transparent", border: "none", borderBottom: tab === id ? `2px solid ${PRIMARY}` : "2px solid transparent", color: tab === id ? PRIMARY : "rgba(255,255,255,0.4)", cursor: "pointer" }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── COOK TAB ── */}
        {tab === "cook" && (
          <>
            <section className="hud-hero">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <span className="hud-label" style={{ color: "rgba(255,255,255,0.4)", fontSize: 8 }}>COZINHA INTELIGENTE</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
                    <span style={{ fontSize: 30, color: currentGoal.color }}>{currentGoal.icon}</span>
                    <strong style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 22, color: currentGoal.color, letterSpacing: "0.1em" }}>MODO {currentGoal.label}</strong>
                  </div>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 8, maxWidth: 480, lineHeight: 1.5 }}>
                    Lista seus ingredientes, escolhe o objetivo, e a IA monta receita com passos, substituições e lista de compras.
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <TagPill icon="◯" label={`${ingredients.length} ingredientes`} color={ACCENT} variant="solid" size="md" />
                  <TagPill label={`${servings} ${servings > 1 ? "porções" : "porção"}`} color={PRIMARY} variant="outline" size="md" />
                </div>
              </div>
            </section>

            {/* Quick ideas */}
            <section style={{ padding: 14, background: `${PRIMARY}06`, border: `1px solid ${PRIMARY}18`, borderRadius: 10 }}>
              <div className="hud-label" style={{ fontSize: 8, color: PRIMARY, marginBottom: 10 }}>IDEIAS RÁPIDAS</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {QUICK_IDEAS.map((idea) => (
                  <motion.button key={idea.text} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    onClick={() => handleQuickIdea(idea.text)}
                    style={{ padding: "7px 12px", fontSize: 11, background: `${PRIMARY}08`, border: `1px solid ${PRIMARY}25`, color: "rgba(255,255,255,0.65)", borderRadius: 6, cursor: "pointer", fontFamily: "'Rajdhani', sans-serif", display: "flex", alignItems: "center", gap: 5 }}>
                    {idea.icon} {idea.text}
                  </motion.button>
                ))}
              </div>
            </section>

            {/* Config */}
            <section className="dash-section">
              <div className="hud-label" style={{ color: PRIMARY, fontSize: 10, marginBottom: 14 }}>DESPENSA</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <input className="orion-input" value={ingredientInput}
                  onChange={(e) => setIngredientInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addIngredient(ingredientInput); }}
                  placeholder="Adicionar ingrediente e Enter"
                  style={{ flex: 1, minWidth: 200 }} />
                <button onClick={() => addIngredient(ingredientInput)} className="orion-command" style={{ color: PRIMARY, borderColor: `${PRIMARY}55`, background: `${PRIMARY}14` }}>+ ADD</button>
              </div>

              {ingredients.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12, padding: 10, borderRadius: 8, background: "rgba(255,255,255,0.015)", border: `1px solid ${ACCENT}22` }}>
                  {ingredients.map((item) => (
                    <button key={item} onClick={() => setIngredients((p) => p.filter((i) => i !== item))}
                      style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", fontSize: 11, fontFamily: "'Share Tech Mono', monospace", color: ACCENT, background: `${ACCENT}18`, border: `1px solid ${ACCENT}44`, borderRadius: 4, cursor: "pointer" }}>
                      {item}<span style={{ color: `${ACCENT}80`, fontSize: 10 }}>×</span>
                    </button>
                  ))}
                </div>
              )}

              <div style={{ marginBottom: 12 }}>
                <div className="hud-label" style={{ color: "rgba(255,255,255,0.35)", fontSize: 8, marginBottom: 6 }}>SUGESTÕES RÁPIDAS</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {COMMON_INGREDIENTS.filter((i) => !ingredients.includes(i)).map((item) => (
                    <TagPill key={item} label={item} color="rgba(255,255,255,0.5)" onClick={() => addIngredient(item)} size="xs" />
                  ))}
                </div>
              </div>

              <div className="hud-divider" />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                <div>
                  <div className="hud-label" style={{ color: "rgba(255,255,255,0.4)", fontSize: 8, marginBottom: 8 }}>OBJETIVO</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {GOAL_OPTIONS.map((g) => (
                      <TagPill key={g.value} icon={g.icon} label={g.label} color={g.color} variant={goal === g.value ? "solid" : "outline"} active={goal === g.value} onClick={() => setGoal(g.value)} />
                    ))}
                  </div>
                </div>
                <div>
                  <div className="hud-label" style={{ color: "rgba(255,255,255,0.4)", fontSize: 8, marginBottom: 8 }}>PORÇÕES</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button onClick={() => setServings((s) => Math.max(1, s - 1))} className="orion-command" style={{ padding: "6px 12px", color: PRIMARY, borderColor: `${PRIMARY}44` }}>−</button>
                    <strong style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 22, color: PRIMARY, minWidth: 28, textAlign: "center" }}>{servings}</strong>
                    <button onClick={() => setServings((s) => Math.min(10, s + 1))} className="orion-command" style={{ padding: "6px 12px", color: PRIMARY, borderColor: `${PRIMARY}44` }}>+</button>
                  </div>
                </div>
                <div>
                  <div className="hud-label" style={{ color: "rgba(255,255,255,0.4)", fontSize: 8, marginBottom: 8 }}>RESTRIÇÕES</div>
                  <input className="orion-input" value={restrictions} onChange={(e) => setRestrictions(e.target.value)} placeholder="Sem glúten, vegetariano..." />
                </div>
              </div>

              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={run} disabled={recipe.isPending || ingredients.length === 0}
                className="orion-command"
                style={{ color: PRIMARY, borderColor: `${PRIMARY}77`, background: `linear-gradient(135deg, ${PRIMARY}1A, transparent)`, marginTop: 14, fontSize: 11, padding: "12px 18px", boxShadow: `0 0 12px ${PRIMARY}33`, opacity: ingredients.length === 0 ? 0.4 : 1, width: "100%" }}>
                {recipe.isPending ? "◌ COZINHANDO..." : "▷ GERAR RECEITA"}
              </motion.button>
            </section>

            {/* Resultado */}
            <AnimatePresence>
              {recipe.data && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <section className="dash-section">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
                      <div>
                        <span className="hud-label" style={{ color: "rgba(255,255,255,0.4)", fontSize: 8 }}>RECEITA PRONTA</span>
                        <strong style={{ display: "block", fontFamily: "'Share Tech Mono', monospace", fontSize: 20, color: PRIMARY, marginTop: 4 }}>{recipe.data.title}</strong>
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <TagPill icon="◷" label={`${recipe.data.prepMinutes}min`} color={ACCENT} variant="solid" />
                        <TagPill label={`${recipe.data.servings} porções`} color={PRIMARY} variant="outline" />
                        <motion.button whileHover={{ scale: 1.05 }} onClick={() => setShowSaveForm((p) => !p)}
                          style={{ padding: "6px 12px", fontSize: 10, background: showSaveForm ? `${PRIMARY}25` : `${PRIMARY}10`, border: `1px solid ${PRIMARY}50`, color: PRIMARY, borderRadius: 5, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace" }}>
                          {showSaveForm ? "× FECHAR" : "⭐ SALVAR NA COLEÇÃO"}
                        </motion.button>
                      </div>
                    </div>

                    {/* Save form */}
                    <AnimatePresence>
                      {showSaveForm && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden", marginBottom: 14 }}>
                          <div style={{ padding: 14, background: `${PRIMARY}08`, border: `1px solid ${PRIMARY}25`, borderRadius: 8 }}>
                            <div style={{ marginBottom: 10 }}>
                              <div className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>AVALIAÇÃO (obrigatório)</div>
                              <div style={{ display: "flex", gap: 4 }}>
                                {[1,2,3,4,5].map((n) => (
                                  <motion.button key={n} whileHover={{ scale: 1.15 }} onClick={() => setSaveRating(n)}
                                    style={{ fontSize: 24, background: "transparent", border: "none", cursor: "pointer", color: n <= saveRating ? PRIMARY : "rgba(255,255,255,0.15)", filter: n <= saveRating ? `drop-shadow(0 0 4px ${PRIMARY})` : "none" }}>
                                    ⭐
                                  </motion.button>
                                ))}
                              </div>
                            </div>
                            <textarea value={saveNotes} onChange={(e) => setSaveNotes(e.target.value)}
                              placeholder="Notas pessoais (ficou bom? o que mudaria? qual ocasião?)"
                              rows={2}
                              style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, color: "#fff", fontSize: 12, fontFamily: "'Rajdhani', sans-serif", outline: "none", marginBottom: 10, resize: "vertical", boxSizing: "border-box" }} />
                            <motion.button whileHover={{ scale: 1.03 }} onClick={handleSave}
                              disabled={saveRating === 0 || saveR.isPending}
                              style={{ padding: "8px 16px", fontSize: 10, background: `${PRIMARY}20`, border: `1px solid ${PRIMARY}`, color: PRIMARY, borderRadius: 6, cursor: saveRating > 0 ? "pointer" : "not-allowed", opacity: saveRating > 0 ? 1 : 0.4, fontFamily: "'Share Tech Mono', monospace" }}>
                              {saveR.isPending ? "◌ SALVANDO..." : "✓ SALVAR NA COLEÇÃO"}
                            </motion.button>
                            {saveR.isSuccess && <span style={{ marginLeft: 10, fontSize: 11, color: ACCENT }}>✓ Salva com sucesso!</span>}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.6, marginBottom: 14 }}>{recipe.data.summary}</p>
                    <TimelineRail color={PRIMARY} nodes={recipe.data.steps.map<TimelineNode>((step, i) => ({ id: `step-${i}`, badge: `PASSO ${String(i + 1).padStart(2, "0")}`, title: step }))} />
                  </section>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
                    <section className="dash-section" style={{ borderColor: `${ACCENT}33` }}>
                      <div className="hud-label" style={{ color: ACCENT, fontSize: 10, marginBottom: 10 }}>◯ LISTA DE COMPRAS</div>
                      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                        {recipe.data.shoppingList.map((item) => (
                          <li key={item} style={{ fontSize: 12.5, color: "rgba(255,255,255,0.72)", paddingLeft: 18, position: "relative", lineHeight: 1.5 }}>
                            <span style={{ position: "absolute", left: 0, top: 3, width: 10, height: 10, border: `1.5px solid ${ACCENT}99`, borderRadius: 2 }} />{item}
                          </li>
                        ))}
                      </ul>
                    </section>
                    <section className="dash-section" style={{ borderColor: `${PRIMARY}33` }}>
                      <div className="hud-label" style={{ color: PRIMARY, fontSize: 10, marginBottom: 10 }}>⇄ SUBSTITUIÇÕES</div>
                      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                        {recipe.data.swaps.map((swap) => (
                          <li key={swap} style={{ fontSize: 12, color: "rgba(255,255,255,0.68)", paddingLeft: 16, position: "relative", lineHeight: 1.5 }}>
                            <span style={{ position: "absolute", left: 0, top: 5, color: PRIMARY, fontSize: 11 }}>⇄</span>{swap}
                          </li>
                        ))}
                      </ul>
                    </section>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* ── SAVED TAB ── */}
        {tab === "saved" && (
          <div>
            {saved.isLoading && (
              <div className="hud-label" style={{ color: "rgba(255,255,255,0.4)", padding: 40, textAlign: "center" }}>◌ carregando coleção...</div>
            )}
            {!saved.isLoading && savedList.length === 0 && (
              <div style={{ padding: 40, textAlign: "center", background: "rgba(255,255,255,0.015)", border: `1px dashed ${PRIMARY}25`, borderRadius: 12 }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📖</div>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>Coleção vazia</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Gere uma receita e clique em ⭐ SALVAR NA COLEÇÃO para guardar aqui.</div>
              </div>
            )}
            {savedList.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {savedList.map((r) => (
                  <div key={r.id} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${PRIMARY}20`, borderLeft: `3px solid ${PRIMARY}`, borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "14px 16px", cursor: "pointer" }}
                      onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <strong style={{ fontSize: 14, color: "rgba(255,255,255,0.9)", fontFamily: "'Share Tech Mono', monospace" }}>{r.title}</strong>
                          <span style={{ fontSize: 11, color: PRIMARY }}>{"⭐".repeat(r.rating)}</span>
                        </div>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: "'Share Tech Mono', monospace", marginTop: 4 }}>
                          {r.prepMinutes}min · {r.servings} porções · {new Date(r.createdAt).toLocaleDateString("pt-BR")} · GOAL: {r.goal.toUpperCase()}
                        </div>
                        {r.notes && <div style={{ fontSize: 11, color: `${PRIMARY}aa`, marginTop: 4, fontStyle: "italic" }}>"{r.notes}"</div>}
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{expandedId === r.id ? "▲" : "▼"}</span>
                        <button onClick={(e) => { e.stopPropagation(); deleteR.mutate(r.id); }}
                          style={{ padding: "4px 8px", fontSize: 11, background: "transparent", border: "1px solid rgba(239,68,68,0.25)", color: "rgba(239,68,68,0.55)", borderRadius: 4, cursor: "pointer" }}>
                          ×
                        </button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {expandedId === r.id && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
                          <div style={{ padding: "0 16px 16px" }}>
                            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.6, marginBottom: 12 }}>{r.summary}</p>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
                              {(r.ingredients as string[]).map((ing) => (
                                <span key={ing} style={{ padding: "2px 8px", fontSize: 10, background: `${ACCENT}12`, border: `1px solid ${ACCENT}25`, borderRadius: 3, color: ACCENT, fontFamily: "'Share Tech Mono', monospace" }}>{ing}</span>
                              ))}
                            </div>
                            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                              {(r.steps as string[]).map((step, i) => (
                                <div key={i} style={{ paddingLeft: 16, position: "relative", marginBottom: 5, lineHeight: 1.5 }}>
                                  <span style={{ position: "absolute", left: 0, color: PRIMARY, fontFamily: "'Share Tech Mono', monospace" }}>{i + 1}.</span>{step}
                                </div>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <ModuleChat
        module="chef"
        label="CHEF"
        color={PRIMARY}
        welcome="Me conta o que tens na geladeira ou o que estás com vontade de comer, e monto receitas perfeitas pra você."
        suggestions={["O que fazer com frango?", "Receita rápida 15min", "Sobremesa fácil", "Janta saudável"]}
      />
    </ModuleShell>
  );
}
