import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ModuleShell } from "../../components/layout/ModuleShell.js";
import { ModuleChat } from "../../components/panels/ModuleChat.js";
import { useCreateWishlistItem, useRemoveWishlistItem, useUpdateWishlistItem, useWishlist } from "../../hooks/modules/useShop.js";

const PRIMARY = "#F59E0B";
const ACCENT = "#00D4FF";
const GREEN = "#10B981";
const RED = "#EF4444";

function brl(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

const CATEGORIES = [
  { id: "all", label: "TODOS", icon: "◇" },
  { id: "tech", label: "TECH", icon: "◈" },
  { id: "fashion", label: "MODA", icon: "◉" },
  { id: "home", label: "CASA", icon: "◎" },
  { id: "health", label: "SAUDE", icon: "♡" },
  { id: "other", label: "OUTROS", icon: "◌" },
];

function guessCategory(name: string): string {
  const n = name.toLowerCase();
  if (/iphone|samsung|airpods|notebook|pc|gpu|monitor|headset|teclado|mouse|tablet|watch|galaxy|pixel/.test(n)) return "tech";
  if (/tenis|roupa|camiseta|calca|vestido|bolsa|sapato|jaqueta/.test(n)) return "fashion";
  if (/cama|sofa|mesa|cadeira|luminaria|decoracao|cortina|panela/.test(n)) return "home";
  if (/vitamina|suplemento|whey|creatina|proteina/.test(n)) return "health";
  return "other";
}

export function ShopPage(): JSX.Element {
  const { data: items, isLoading } = useWishlist();
  const create = useCreateWishlistItem();
  const update = useUpdateWishlistItem();
  const remove = useRemoveWishlistItem();

  const [mode, setMode] = useState<"easy" | "manual">("easy");
  const [productName, setProductName] = useState("");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [sortBy, setSortBy] = useState<"recent" | "price" | "drop">("recent");
  const [showBuyingTips, setShowBuyingTips] = useState(false);

  const createEasy = (): void => {
    if (!productName.trim()) return;
    create.mutate({ name: productName.trim(), url: `https://busca.orion/${encodeURIComponent(productName.trim())}` }, { onSuccess: () => setProductName("") });
  };

  const createManual = (): void => {
    if (!name.trim()) return;
    create.mutate({
      name: name.trim(),
      url: url.trim() || `https://busca.orion/${encodeURIComponent(name.trim())}`,
      targetPrice: targetPrice ? Number(targetPrice) : undefined,
      currentPrice: currentPrice ? Number(currentPrice) : undefined,
    }, { onSuccess: () => { setName(""); setUrl(""); setTargetPrice(""); setCurrentPrice(""); } });
  };

  const allItems = items ?? [];
  const alertItems = allItems.filter((i) => i.shouldAlert);
  const totalValue = allItems.reduce((s, i) => s + (i.currentPrice ?? 0), 0);
  const totalTarget = allItems.reduce((s, i) => s + (i.targetPrice ?? 0), 0);
  const potentialSavings = totalValue - totalTarget;

  // Filter and sort
  const filtered = activeCategory === "all"
    ? allItems
    : allItems.filter((i) => guessCategory(i.name) === activeCategory);

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "price") return (b.currentPrice ?? 0) - (a.currentPrice ?? 0);
    if (sortBy === "drop") return (b.dropPct ?? 0) - (a.dropPct ?? 0);
    return 0; // recent = default order
  });

  return (
    <ModuleShell icon="◬" label="COMPRAS" sub="Wishlist · Monitoramento · Alertas de Preco · Comparador" color={PRIMARY}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* ── Hero Stats ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 20 }}>
          <HeroStat label="MONITORANDO" value={`${allItems.length}`} sub="produtos" color={PRIMARY} icon="◬" />
          <HeroStat label="ALERTAS" value={`${alertItems.length}`} sub={alertItems.length > 0 ? "prontos pra comprar!" : "nenhum ativo"} color={alertItems.length > 0 ? GREEN : "rgba(255,255,255,0.3)"} icon={"\u{1F514}"} />
          <HeroStat label="VALOR TOTAL" value={brl(totalValue)} sub="na wishlist" color={ACCENT} icon="◈" />
          <HeroStat label="ECONOMIA" value={potentialSavings > 0 ? brl(potentialSavings) : "—"} sub={potentialSavings > 0 ? "se comprar no alvo" : "defina precos alvo"} color={potentialSavings > 0 ? GREEN : "rgba(255,255,255,0.3)"} icon="↓" />
        </div>

        {/* ── Alert Banner ── */}
        <AnimatePresence>
          {alertItems.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                padding: 16, marginBottom: 20,
                background: `linear-gradient(135deg, ${GREEN}12, transparent)`,
                border: `1px solid ${GREEN}40`,
                borderRadius: 10,
              }}
            >
              <div className="hud-label" style={{ fontSize: 10, color: GREEN, letterSpacing: "0.15em", marginBottom: 8 }}>
                {"\u{1F389}"} HORA DE COMPRAR!
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {alertItems.map((item) => (
                  <div key={item.id} style={{
                    padding: "8px 12px",
                    background: `${GREEN}10`,
                    border: `1px solid ${GREEN}30`,
                    borderRadius: 6,
                    fontSize: 12,
                    color: "rgba(255,255,255,0.85)",
                  }}>
                    <strong>{item.name}</strong>
                    {item.dropPct != null && (
                      <span style={{ color: GREEN, fontFamily: "'Share Tech Mono', monospace", marginLeft: 8 }}>
                        ↓{item.dropPct}%
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* ── Add Product ── */}
        <section style={{
          padding: 18, marginBottom: 20,
          background: `linear-gradient(135deg, ${PRIMARY}06, transparent)`,
          border: `1px solid ${PRIMARY}25`,
          borderRadius: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div className="hud-label" style={{ fontSize: 10, color: PRIMARY, letterSpacing: "0.12em" }}>
              ADICIONAR PRODUTO
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {(["easy", "manual"] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)} style={{
                  padding: "4px 10px", fontSize: 9,
                  fontFamily: "'Share Tech Mono', monospace",
                  background: mode === m ? `${PRIMARY}20` : "transparent",
                  border: `1px solid ${mode === m ? PRIMARY : "rgba(255,255,255,0.1)"}`,
                  color: mode === m ? PRIMARY : "rgba(255,255,255,0.4)",
                  borderRadius: 4, cursor: "pointer",
                }}>
                  {m === "easy" ? "RAPIDO" : "DETALHADO"}
                </button>
              ))}
            </div>
          </div>

          {mode === "easy" ? (
            <div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>
                Fala o que quer comprar. O ORION monitora pra voce.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createEasy()}
                  placeholder="Ex: Samsung Galaxy S26 Ultra, AirPods Pro, Nike Air Max..."
                  style={{
                    flex: 1, padding: "10px 14px",
                    background: "rgba(255,255,255,0.03)",
                    border: `1px solid rgba(255,255,255,0.1)`,
                    borderRadius: 8, color: "#fff", fontSize: 13,
                    fontFamily: "'Rajdhani', sans-serif", outline: "none",
                  }}
                />
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  onClick={createEasy}
                  disabled={!productName.trim() || create.isPending}
                  className="orion-command"
                  style={{
                    color: PRIMARY, borderColor: `${PRIMARY}55`,
                    background: `${PRIMARY}14`, padding: "10px 18px",
                    opacity: productName.trim() ? 1 : 0.4,
                  }}
                >
                  {create.isPending ? "..." : "+ MONITORAR"}
                </motion.button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                <input className="orion-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do produto" />
                <input className="orion-input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL (opcional)" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input className="orion-input" value={currentPrice} onChange={(e) => setCurrentPrice(e.target.value)} placeholder="Preco atual (R$)" type="number" />
                <input className="orion-input" value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)} placeholder="Preco alvo (R$)" type="number" />
              </div>
              <motion.button
                whileHover={{ scale: 1.03 }}
                onClick={createManual}
                disabled={!name.trim() || create.isPending}
                className="orion-command"
                style={{ color: PRIMARY, borderColor: `${PRIMARY}55`, background: `${PRIMARY}14`, marginTop: 10 }}
              >
                MONITORAR
              </motion.button>
            </div>
          )}
        </section>

        {/* ── Filters + Sort ── */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          {CATEGORIES.map((c) => {
            const count = c.id === "all" ? allItems.length : allItems.filter((i) => guessCategory(i.name) === c.id).length;
            return (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                style={{
                  padding: "6px 12px", fontSize: 9,
                  fontFamily: "'Share Tech Mono', monospace",
                  background: activeCategory === c.id ? `${PRIMARY}20` : "rgba(255,255,255,0.02)",
                  border: `1px solid ${activeCategory === c.id ? PRIMARY : "rgba(255,255,255,0.08)"}`,
                  color: activeCategory === c.id ? PRIMARY : "rgba(255,255,255,0.4)",
                  borderRadius: 20, cursor: "pointer",
                }}
              >
                {c.icon} {c.label} {count > 0 && `(${count})`}
              </button>
            );
          })}
          <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
            {([["recent", "RECENTE"], ["price", "PRECO"], ["drop", "QUEDA"]] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSortBy(key as typeof sortBy)}
                style={{
                  padding: "4px 8px", fontSize: 8,
                  fontFamily: "'Share Tech Mono', monospace",
                  background: sortBy === key ? "rgba(255,255,255,0.08)" : "transparent",
                  border: `1px solid ${sortBy === key ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.06)"}`,
                  color: sortBy === key ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.3)",
                  borderRadius: 3, cursor: "pointer",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Loading ── */}
        {isLoading && (
          <div className="hud-label" style={{ color: "rgba(255,255,255,0.3)", padding: 30, textAlign: "center" }}>
            Carregando wishlist...
          </div>
        )}

        {/* ── Empty State ── */}
        {!isLoading && sorted.length === 0 && (
          <div style={{
            padding: 40, textAlign: "center",
            background: "rgba(255,255,255,0.015)",
            border: `1px dashed ${PRIMARY}25`, borderRadius: 12,
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>{"\u{1F6D2}"}</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", marginBottom: 8 }}>
              {activeCategory !== "all" ? "Nenhum produto nesta categoria" : "Wishlist vazia"}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", maxWidth: 400, margin: "0 auto" }}>
              Adicione produtos acima ou use o chat para pedir ao ORION que pesquise e monitore precos pra voce.
            </div>
          </div>
        )}

        {/* ── Product Grid ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12, marginBottom: 24 }}>
          {sorted.map((item) => {
            const cat = guessCategory(item.name);
            const catMeta = CATEGORIES.find((c) => c.id === cat) ?? CATEGORIES[5]!;
            const hasTarget = item.targetPrice != null && item.targetPrice > 0;
            const hasCurrent = item.currentPrice != null && item.currentPrice > 0;
            const priceDiff = hasTarget && hasCurrent ? item.currentPrice! - item.targetPrice! : null;
            const isGoodDeal = priceDiff !== null && priceDiff <= 0;

            return (
              <motion.div
                key={item.id}
                layout
                whileHover={{ scale: 1.01 }}
                style={{
                  padding: 16,
                  background: item.shouldAlert ? `${GREEN}06` : "rgba(255,255,255,0.02)",
                  border: `1px solid ${item.shouldAlert ? `${GREEN}40` : "rgba(255,255,255,0.08)"}`,
                  borderLeft: `4px solid ${item.shouldAlert ? GREEN : `${PRIMARY}60`}`,
                  borderRadius: 10,
                }}
              >
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 10, color: `${PRIMARY}88` }}>{catMeta.icon}</span>
                      <span className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.3)" }}>
                        {catMeta.label}
                      </span>
                      {item.shouldAlert && (
                        <span className="hud-label" style={{ fontSize: 8, color: GREEN, background: `${GREEN}15`, padding: "1px 6px", borderRadius: 3 }}>
                          BOM PRECO
                        </span>
                      )}
                    </div>
                    <a href={item.url} target="_blank" rel="noreferrer" style={{
                      color: "rgba(255,255,255,0.9)", fontWeight: 600,
                      textDecoration: "none", fontSize: 14, lineHeight: 1.3,
                    }}>
                      {item.name}
                    </a>
                  </div>
                  <button
                    onClick={() => remove.mutate(item.id)}
                    style={{
                      padding: "2px 6px", fontSize: 10,
                      background: "transparent",
                      border: "1px solid rgba(239,68,68,0.15)",
                      color: "rgba(239,68,68,0.5)",
                      borderRadius: 4, cursor: "pointer",
                    }}
                  >
                    x
                  </button>
                </div>

                {/* Prices */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                  <div style={{
                    padding: "8px 10px",
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 6,
                  }}>
                    <div className="hud-label" style={{ fontSize: 7, color: "rgba(255,255,255,0.3)", marginBottom: 2 }}>ATUAL</div>
                    <div style={{
                      fontSize: 16, fontFamily: "'Share Tech Mono', monospace",
                      fontWeight: 700,
                      color: hasCurrent ? (isGoodDeal ? GREEN : "rgba(255,255,255,0.8)") : "rgba(255,255,255,0.25)",
                    }}>
                      {hasCurrent ? brl(item.currentPrice) : "—"}
                    </div>
                  </div>
                  <div style={{
                    padding: "8px 10px",
                    background: `${PRIMARY}06`,
                    border: `1px solid ${PRIMARY}15`,
                    borderRadius: 6,
                  }}>
                    <div className="hud-label" style={{ fontSize: 7, color: `${PRIMARY}88`, marginBottom: 2 }}>ALVO</div>
                    <div style={{
                      fontSize: 16, fontFamily: "'Share Tech Mono', monospace",
                      fontWeight: 700,
                      color: hasTarget ? PRIMARY : "rgba(255,255,255,0.25)",
                    }}>
                      {hasTarget ? brl(item.targetPrice) : "—"}
                    </div>
                  </div>
                </div>

                {/* Price bar */}
                {hasTarget && hasCurrent && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 99, overflow: "hidden" }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (item.targetPrice! / item.currentPrice!) * 100)}%` }}
                        style={{
                          height: "100%",
                          background: isGoodDeal
                            ? `linear-gradient(90deg, ${GREEN}, ${ACCENT})`
                            : `linear-gradient(90deg, ${PRIMARY}, ${RED})`,
                          borderRadius: 99,
                        }}
                      />
                    </div>
                    <div style={{
                      fontSize: 9, fontFamily: "'Share Tech Mono', monospace",
                      color: isGoodDeal ? GREEN : "rgba(255,255,255,0.3)",
                      marginTop: 4,
                    }}>
                      {isGoodDeal
                        ? `Abaixo do alvo! Economize ${brl(Math.abs(priceDiff!))}`
                        : `Faltam ${brl(priceDiff!)} para o alvo`}
                    </div>
                  </div>
                )}

                {/* Drop badge */}
                {item.dropPct != null && item.dropPct > 0 && (
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "3px 8px",
                    background: `${GREEN}12`,
                    border: `1px solid ${GREEN}30`,
                    borderRadius: 4,
                    fontSize: 10, fontFamily: "'Share Tech Mono', monospace",
                    color: GREEN,
                  }}>
                    {"↓"} {item.dropPct}% queda detectada
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* ── Buying Tips ── */}
        <section style={{
          padding: 16,
          background: `linear-gradient(135deg, ${PRIMARY}06, transparent)`,
          border: `1px solid ${PRIMARY}15`,
          borderRadius: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div className="hud-label" style={{ fontSize: 10, color: PRIMARY, letterSpacing: "0.12em" }}>
              DICAS DE COMPRA
            </div>
            <button
              onClick={() => setShowBuyingTips((p) => !p)}
              style={{
                padding: "3px 8px", fontSize: 9,
                background: "transparent",
                border: `1px solid ${PRIMARY}30`,
                color: `${PRIMARY}99`,
                borderRadius: 4, cursor: "pointer",
                fontFamily: "'Share Tech Mono', monospace",
              }}
            >
              {showBuyingTips ? "FECHAR" : "VER DICAS"}
            </button>
          </div>
          <AnimatePresence>
            {showBuyingTips && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                style={{ overflow: "hidden" }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                  <Tip text="Defina um preco alvo realista. O ORION avisa quando chegar la." color={PRIMARY} />
                  <Tip text="Melhores epocas: Black Friday (nov), Amazon Prime Day (jul), volta as aulas (jan/fev)." color={ACCENT} />
                  <Tip text="Compare sempre em pelo menos 3 lojas antes de comprar." color={GREEN} />
                  <Tip text="Use o chat pra pedir ao ORION que pesquise reviews e compare opcoes." color="#7C3AED" />
                  {allItems.length > 0 && totalValue > 1000 && (
                    <Tip text={`Sua wishlist soma ${brl(totalValue)}. Priorize os itens com maior queda de preco.`} color={RED} />
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {!showBuyingTips && (
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 6 }}>
              Estrategias de economia e melhores momentos pra comprar.
            </div>
          )}
        </section>
      </div>

      <ModuleChat
        module="shop"
        label="COMPRAS"
        color={PRIMARY}
        welcome="Posso monitorar precos, comparar produtos, organizar sua wishlist e avisar quando baixar. O que voce ta querendo comprar?"
        suggestions={["Comparar precos", "Melhor hora pra comprar", "Vale a pena esse produto?", "Alternativas mais baratas"]}
      />
    </ModuleShell>
  );
}

function HeroStat(props: { label: string; value: string; sub: string; color: string; icon: string }): JSX.Element {
  return (
    <div style={{
      padding: 14,
      background: `${props.color}06`,
      border: `1px solid ${props.color}20`,
      borderRadius: 10, textAlign: "center",
    }}>
      <div style={{ fontSize: 18, marginBottom: 4, filter: `drop-shadow(0 0 4px ${props.color}40)` }}>{props.icon}</div>
      <div className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>{props.label}</div>
      <div style={{
        fontSize: 18, fontFamily: "'Share Tech Mono', monospace",
        fontWeight: 700, color: props.color,
        textShadow: `0 0 10px ${props.color}30`,
      }}>
        {props.value}
      </div>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{props.sub}</div>
    </div>
  );
}

function Tip(props: { text: string; color: string }): JSX.Element {
  return (
    <div style={{
      padding: "8px 12px",
      background: `${props.color}08`,
      border: `1px solid ${props.color}20`,
      borderRadius: 6,
      fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 1.5,
    }}>
      {props.text}
    </div>
  );
}
