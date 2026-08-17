import { useMemo, useState } from "react";
import { ModuleShell } from "../../components/layout/ModuleShell.js";
import { ModuleChat } from "../../components/panels/ModuleChat.js";
import { useCreateSocialContact, useSocialContacts, useSocialNudges } from "../../hooks/modules/useSocial.js";
import { TagPill } from "../../components/visual/TagPill.js";
import { RingGauge } from "../../components/visual/RingGauge.js";

const PRIMARY = "#EC4899";
const ACCENT = "#00D4FF";
const WARN = "#F59E0B";

/* ═══════════════════════════════════════════════════════════════════
   SOCIAL — CRM pessoal, agora com camada de prioridade visual.

   Refeito: hero com health score do networking (% contatos com nextStep
   pendente x total), filtros por importancia, lista de contatos como
   cards com importance gauge, painel de nudges proativos.
═══════════════════════════════════════════════════════════════════ */

type SortKey = "importance" | "recent" | "stale";

export function SocialPage(): JSX.Element {
  const contacts = useSocialContacts();
  const nudges = useSocialNudges();
  const create = useCreateSocialContact();

  const [name, setName] = useState("");
  const [context, setContext] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [importance, setImportance] = useState(6);
  const [sort, setSort] = useState<SortKey>("importance");
  const [filter, setFilter] = useState<"all" | "high" | "stale">("all");

  const list = contacts.data ?? [];

  const stats = useMemo(() => {
    const total = list.length;
    const withNextStep = list.filter((c) => c.nextStep && c.nextStep.trim()).length;
    const highImportance = list.filter((c) => c.importance >= 8).length;
    const now = Date.now();
    const stale = list.filter((c) => {
      if (!c.lastInteraction) return true;
      const last = new Date(c.lastInteraction).getTime();
      return now - last > 30 * 24 * 60 * 60 * 1000;
    }).length;
    const healthScore = total === 0 ? 0 : Math.round((withNextStep / total) * 100);
    return { total, withNextStep, highImportance, stale, healthScore };
  }, [list]);

  const filtered = useMemo(() => {
    let result = [...list];
    if (filter === "high") result = result.filter((c) => c.importance >= 8);
    if (filter === "stale") result = result.filter((c) => {
      if (!c.lastInteraction) return true;
      return Date.now() - new Date(c.lastInteraction).getTime() > 30 * 24 * 60 * 60 * 1000;
    });
    if (sort === "importance") result.sort((a, b) => b.importance - a.importance);
    else if (sort === "recent") result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    else result.sort((a, b) => {
      const aDate = a.lastInteraction ? new Date(a.lastInteraction).getTime() : 0;
      const bDate = b.lastInteraction ? new Date(b.lastInteraction).getTime() : 0;
      return aDate - bDate;
    });
    return result;
  }, [list, filter, sort]);

  const add = (): void => {
    if (!name.trim()) return;
    create.mutate({
      name: name.trim(),
      context: context.trim() || undefined,
      nextStep: nextStep.trim() || undefined,
      importance,
    }, {
      onSuccess: () => {
        setName("");
        setContext("");
        setNextStep("");
        setImportance(6);
      },
    });
  };

  return (
    <ModuleShell icon="◫" label="SOCIAL" sub="Seus contatos importantes · Lembretes de quem falar · Networking" color={PRIMARY}>
      <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ━━━ HERO + STATS ━━━ */}
        <section className="hud-hero">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <div>
              <span className="hud-label" style={{ color: "rgba(255,255,255,0.4)", fontSize: 8 }}>
                RELATIONSHIP GRAPH
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
                <strong style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: 26,
                  color: PRIMARY,
                  letterSpacing: "0.1em",
                  textShadow: `0 0 10px ${PRIMARY}66`,
                }}>
                  {stats.total} CONTATOS
                </strong>
                {stats.stale > 0 && (
                  <TagPill icon="!" label={`${stats.stale} esfriando`} color={WARN} variant="solid" />
                )}
              </div>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 8, maxWidth: 440, lineHeight: 1.5 }}>
                Seu CRM pessoal — registre quem importa, defina próximas ações e o ORION avisa quando alguém está "esfriando" (30+ dias sem contato). Ele também sugere mensagens pra retomar a conversa.
              </p>
            </div>
            <RingGauge value={stats.healthScore} centerLabel={`${stats.healthScore}%`} topLabel="SAUDE" bottomLabel="networking" color={PRIMARY} size={110} />
          </div>

          <div className="hud-divider" />

          <div className="hud-metric-row">
            <MicroStat label="ALTA IMPORTANCIA" value={stats.highImportance} color={PRIMARY} />
            <MicroStat label="COM PROXIMO PASSO" value={stats.withNextStep} color={ACCENT} />
            <MicroStat label="ESFRIANDO 30d+" value={stats.stale} color={WARN} />
            <MicroStat label="NUDGES IA" value={nudges.data?.length ?? 0} color="#7C3AED" />
          </div>
        </section>

        {/* ━━━ FORM ADD ━━━ */}
        <section className="dash-section">
          <div className="hud-label" style={{ color: PRIMARY, fontSize: 10, marginBottom: 12, letterSpacing: "0.22em" }}>
            REGISTRAR CONTATO
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 10 }}>
            <input className="orion-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" />
            <input className="orion-input" value={context} onChange={(e) => setContext(e.target.value)} placeholder="Contexto (onde conheceu, area...)" />
            <input className="orion-input" value={nextStep} onChange={(e) => setNextStep(e.target.value)} placeholder="Proximo passo (mandar artigo, marcar cafe...)" />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div className="hud-label" style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", marginBottom: 5 }}>
                IMPORTANCIA · {importance}/10
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={importance}
                onChange={(e) => setImportance(Number(e.target.value))}
                className="hud-slider"
                style={{ accentColor: PRIMARY }}
              />
            </div>
            <button
              onClick={add}
              disabled={create.isPending || !name.trim()}
              className="orion-command"
              style={{
                color: PRIMARY,
                borderColor: `${PRIMARY}77`,
                background: `linear-gradient(135deg, ${PRIMARY}1A, transparent)`,
                fontSize: 11,
                padding: "10px 16px",
                boxShadow: `0 0 12px ${PRIMARY}33`,
                opacity: !name.trim() ? 0.4 : 1,
              }}
            >
              {create.isPending ? "◌ SALVANDO..." : "+ ADICIONAR"}
            </button>
          </div>
        </section>

        {/* ━━━ FILTROS + LISTAGEM ━━━ */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(280px, 1fr)", gap: 12 }}>
          <section className="dash-section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <span className="hud-label" style={{ color: PRIMARY, fontSize: 10, letterSpacing: "0.22em" }}>
                CONTATOS · {filtered.length}
              </span>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                <TagPill label="TODOS" color={ACCENT} variant={filter === "all" ? "solid" : "outline"} active={filter === "all"} onClick={() => setFilter("all")} />
                <TagPill label="ALTA" color={PRIMARY} variant={filter === "high" ? "solid" : "outline"} active={filter === "high"} onClick={() => setFilter("high")} />
                <TagPill label="ESFRIANDO" color={WARN} variant={filter === "stale" ? "solid" : "outline"} active={filter === "stale"} onClick={() => setFilter("stale")} />
                <span style={{ width: 1, background: "rgba(255,255,255,0.08)", margin: "0 4px" }} />
                <TagPill label="POR IMPORTANCIA" color="rgba(255,255,255,0.5)" variant={sort === "importance" ? "solid" : "outline"} active={sort === "importance"} onClick={() => setSort("importance")} />
                <TagPill label="POR RECENTES" color="rgba(255,255,255,0.5)" variant={sort === "recent" ? "solid" : "outline"} active={sort === "recent"} onClick={() => setSort("recent")} />
                <TagPill label="POR STALE" color="rgba(255,255,255,0.5)" variant={sort === "stale" ? "solid" : "outline"} active={sort === "stale"} onClick={() => setSort("stale")} />
              </div>
            </div>

            {filtered.length === 0 ? (
              <div style={{
                padding: 30,
                textAlign: "center",
                fontSize: 12,
                color: "rgba(255,255,255,0.35)",
                border: "1px dashed rgba(255,255,255,0.08)",
                borderRadius: 8,
              }}>
                {list.length === 0 ? (
                  <div>
                    <div style={{ fontSize: 28, marginBottom: 10 }}>👥</div>
                    <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>
                      Seu CRM pessoal está vazio
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", lineHeight: 1.6, maxWidth: 400, margin: "0 auto" }}>
                      Adicione pessoas importantes — amigos, mentores, colegas, contatos profissionais.
                      O ORION avisa quando faz tempo que você não fala com alguém e sugere o que dizer.
                      Pense nisso como um "CRM do networking pessoal".
                    </div>
                  </div>
                ) : "Nenhum contato nessa visualização."}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }} className="hud-stagger">
                {filtered.map((contact) => (
                  <ContactCard key={contact.id} contact={contact} />
                ))}
              </div>
            )}
          </section>

          <section className="dash-section" style={{ borderColor: `#7C3AED33`, alignSelf: "flex-start" }}>
            <div className="hud-label" style={{ color: "#7C3AED", fontSize: 10, marginBottom: 12, letterSpacing: "0.22em" }}>
              ◇ NUDGES INTELIGENTES
            </div>
            {(nudges.data ?? []).length === 0 ? (
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
                Sem sugestoes agora. A IA gera nudges quando detecta contatos esfriando ou oportunidades.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }} className="hud-stagger">
                {(nudges.data ?? []).map((nudge) => (
                  <article key={nudge.contactId} style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid #7C3AED33",
                    background: "linear-gradient(135deg, #7C3AED12, transparent)",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                      <strong style={{ fontSize: 13, color: "rgba(255,255,255,0.85)" }}>{nudge.name}</strong>
                      <TagPill label="NUDGE" color="#7C3AED" size="xs" />
                    </div>
                    <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.6)", lineHeight: 1.5, margin: "0 0 6px 0" }}>
                      {nudge.reason}
                    </p>
                    {nudge.messageDraft && (
                      <div style={{
                        fontSize: 11,
                        color: "#7C3AED",
                        padding: "6px 8px",
                        background: "#7C3AED10",
                        borderLeft: "2px solid #7C3AED",
                        borderRadius: 3,
                        fontStyle: "italic",
                        lineHeight: 1.45,
                      }}>
                        "{nudge.messageDraft}"
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
      <ModuleChat
        module="social"
        label="SOCIAL"
        color={PRIMARY}
        welcome="Sou seu CRM pessoal. Gerencio seus contatos importantes, lembro quem voce precisa falar e sugiro proximos passos de networking."
        suggestions={["Quem devo contatar?", "Resumo networking", "Proximos passos", "Aniversarios"]}
      />
    </ModuleShell>
  );
}

function MicroStat({ label, value, color }: { label: string; value: number; color: string }): JSX.Element {
  return (
    <div className="hud-metric" style={{ "--accent": color } as React.CSSProperties}>
      <small style={{ color }}>{label}</small>
      <strong style={{ color }}>{value}</strong>
    </div>
  );
}

function ContactCard({ contact }: { contact: { id: string; name: string; context: string; nextStep: string; importance: number; lastInteraction: string | null; updatedAt: string } }): JSX.Element {
  const isStale = !contact.lastInteraction || (Date.now() - new Date(contact.lastInteraction).getTime()) > 30 * 24 * 60 * 60 * 1000;
  const impColor = contact.importance >= 8 ? PRIMARY : contact.importance >= 5 ? ACCENT : "rgba(255,255,255,0.4)";

  return (
    <article style={{
      padding: "12px 14px",
      borderRadius: 8,
      border: `1px solid ${impColor}22`,
      borderLeft: `3px solid ${impColor}`,
      background: `linear-gradient(135deg, ${impColor}08, transparent 70%)`,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <strong style={{ fontSize: 14, color: "rgba(255,255,255,0.92)", fontWeight: 600 }}>{contact.name}</strong>
          {isStale && <TagPill icon="!" label="stale" color={WARN} size="xs" />}
        </div>
        {contact.context && (
          <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.55)", margin: "0 0 6px 0", lineHeight: 1.45 }}>
            {contact.context}
          </p>
        )}
        {contact.nextStep && (
          <div style={{
            fontSize: 11.5,
            color: ACCENT,
            padding: "5px 8px",
            background: `${ACCENT}10`,
            borderLeft: `2px solid ${ACCENT}`,
            borderRadius: 3,
            display: "inline-block",
          }}>
            {String.fromCharCode(9655)} {contact.nextStep}
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
        <span className="hud-label" style={{ fontSize: 7, color: "rgba(255,255,255,0.3)" }}>IMP</span>
        <strong style={{
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: 18,
          color: impColor,
          textShadow: `0 0 6px ${impColor}66`,
        }}>
          {contact.importance}
        </strong>
      </div>
    </article>
  );
}
