import { useMemo, useState } from "react";
import type { SecurityRiskLevel } from "@orion/types";
import { ModuleShell } from "../../components/layout/ModuleShell.js";
import { ModuleChat } from "../../components/panels/ModuleChat.js";
import {
  useCreateSecurityAccount,
  useCreateSecurityFinding,
  useResolveSecurityFinding,
  useSecurityPosture,
  useUpdateSecurityAccount,
} from "../../hooks/modules/useSecurity.js";

const PRIMARY = "#38BDF8";
const RISK_COLOR: Record<SecurityRiskLevel, string> = {
  low: "#10B981",
  medium: "#F59E0B",
  high: "#EF4444",
  critical: "#EC4899",
};

export function SecurityPage(): JSX.Element {
  const posture = useSecurityPosture();
  const createAccount = useCreateSecurityAccount();
  const updateAccount = useUpdateSecurityAccount();
  const createFinding = useCreateSecurityFinding();
  const resolveFinding = useResolveSecurityFinding();
  const data = posture.data;

  const [service, setService] = useState("");
  const [category, setCategory] = useState("core");
  const [email, setEmail] = useState("");
  const [hasTwoFactor, setHasTwoFactor] = useState(true);
  const [usesPasswordManager, setUsesPasswordManager] = useState(true);
  const [findingTitle, setFindingTitle] = useState("");
  const [findingDetail, setFindingDetail] = useState("");
  const [findingRisk, setFindingRisk] = useState<SecurityRiskLevel>("medium");

  const signalText = useMemo(() => {
    if (!data) return "CALCULANDO";
    if (data.signal === "hardened") return "HARDENED";
    if (data.signal === "attention") return "ATENCAO";
    return "EXPOSTO";
  }, [data]);

  const addAccount = (): void => {
    if (!service.trim()) return;
    createAccount.mutate(
      {
        service: service.trim(),
        category: category.trim() || "geral",
        email: email.trim() || undefined,
        hasTwoFactor,
        usesPasswordManager,
      },
      {
        onSuccess: () => {
          setService("");
          setEmail("");
        },
      },
    );
  };

  const addFinding = (): void => {
    if (!findingTitle.trim() || !findingDetail.trim()) return;
    createFinding.mutate(
      {
        title: findingTitle.trim(),
        detail: findingDetail.trim(),
        action: "Revisar a conta afetada, remover acesso desnecessario e registrar a correcao.",
        risk: findingRisk,
        source: "guard",
      },
      {
        onSuccess: () => {
          setFindingTitle("");
          setFindingDetail("");
          setFindingRisk("medium");
        },
      },
    );
  };

  return (
    <ModuleShell icon="◇" label="SEGURANCA" sub="Guard pessoal · postura · risco · hardening" color={PRIMARY}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <section className="security-hero">
          <div className="security-score" style={{ borderColor: `${PRIMARY}44` }}>
            <span className="hud-label" style={{ color: PRIMARY }}>POSTURA</span>
            <strong>{data?.score ?? 0}</strong>
            <small>{signalText}</small>
          </div>
          <Metric label="2FA" value={`${data?.twoFactorCoverage ?? 0}%`} color="#10B981" />
          <Metric label="SENHAS UNICAS" value={`${data?.passwordManagerCoverage ?? 0}%`} color="#F59E0B" />
          <Metric label="ACHADOS ABERTOS" value={String(data?.openFindings ?? 0)} color="#EC4899" />
        </section>

        <div className="security-grid">
          <section className="dash-section">
            <div className="hud-label" style={{ color: PRIMARY, fontSize: 10, marginBottom: 12 }}>
              INVENTARIO DE CONTAS
            </div>
            <div className="security-form">
              <input className="orion-input" value={service} onChange={(event) => setService(event.target.value)} placeholder="servico: Gmail, GitHub, banco..." />
              <input className="orion-input" value={category} onChange={(event) => setCategory(event.target.value)} placeholder="categoria" />
              <input className="orion-input" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email/login" />
              <label className="security-toggle">
                <input type="checkbox" checked={hasTwoFactor} onChange={(event) => setHasTwoFactor(event.target.checked)} />
                2FA
              </label>
              <label className="security-toggle">
                <input type="checkbox" checked={usesPasswordManager} onChange={(event) => setUsesPasswordManager(event.target.checked)} />
                vault
              </label>
            </div>
            <button onClick={addAccount} disabled={createAccount.isPending} className="orion-command security-primary">
              REGISTRAR CONTA
            </button>

            <div className="security-account-list">
              {(data?.accounts ?? []).map((account) => (
                <article key={account.id} className="security-account">
                  <div>
                    <strong>{account.service}</strong>
                    <span>{account.category} {account.email ? `· ${account.email}` : ""}</span>
                  </div>
                  <div className="security-account-actions">
                    <button
                      className={account.hasTwoFactor ? "security-chip on" : "security-chip"}
                      onClick={() => updateAccount.mutate({ id: account.id, input: { hasTwoFactor: !account.hasTwoFactor } })}
                    >
                      2FA
                    </button>
                    <button
                      className={account.usesPasswordManager ? "security-chip on" : "security-chip"}
                      onClick={() => updateAccount.mutate({ id: account.id, input: { usesPasswordManager: !account.usesPasswordManager } })}
                    >
                      VAULT
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="dash-section">
            <div className="hud-label" style={{ color: PRIMARY, fontSize: 10, marginBottom: 12 }}>
              PLANO DE HARDENING
            </div>
            <div className="security-checklist">
              {(data?.checklist ?? []).map((item) => (
                <div key={item.id} className={item.done ? "security-check done" : "security-check"}>
                  <i>{item.done ? "OK" : "!"}</i>
                  <div>
                    <strong>{item.label}</strong>
                    <span>{item.detail}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="security-plan">
              {(data?.plan ?? []).map((step) => (
                <article key={step.title} className="security-plan-card" style={{ borderColor: `${RISK_COLOR[step.risk]}44` }}>
                  <span className="hud-label" style={{ color: RISK_COLOR[step.risk] }}>{step.risk}</span>
                  <strong>{step.title}</strong>
                  <p>{step.detail}</p>
                </article>
              ))}
            </div>
          </section>
        </div>

        <section className="dash-section">
          <div className="security-findings-head">
            <div>
              <div className="hud-label" style={{ color: PRIMARY, fontSize: 10 }}>ACHADOS DO GUARD</div>
              <p>Registre riscos manuais agora; depois isso pode receber sinais de GitHub, email, vault e webhooks.</p>
            </div>
            <div className="security-finding-form">
              <input className="orion-input" value={findingTitle} onChange={(event) => setFindingTitle(event.target.value)} placeholder="achado" />
              <input className="orion-input" value={findingDetail} onChange={(event) => setFindingDetail(event.target.value)} placeholder="detalhe" />
              <select className="orion-input" value={findingRisk} onChange={(event) => setFindingRisk(event.target.value as SecurityRiskLevel)}>
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
                <option value="critical">critical</option>
              </select>
              <button onClick={addFinding} disabled={createFinding.isPending} className="orion-command security-primary">
                ADD
              </button>
            </div>
          </div>

          <div className="security-finding-list">
            {(data?.findings ?? []).map((finding) => (
              <article key={finding.id} className={finding.resolved ? "security-finding resolved" : "security-finding"}>
                <span className="hud-label" style={{ color: RISK_COLOR[finding.risk] }}>{finding.risk}</span>
                <div>
                  <strong>{finding.title}</strong>
                  <p>{finding.detail}</p>
                  <small>{finding.action}</small>
                </div>
                {!finding.resolved && (
                  <button className="orion-command" onClick={() => resolveFinding.mutate(finding.id)} disabled={resolveFinding.isPending}>
                    RESOLVER
                  </button>
                )}
              </article>
            ))}
            {!posture.isLoading && (data?.findings.length ?? 0) === 0 && (
              <div className="security-empty">Nenhum achado registrado. O Guard esta limpo por enquanto.</div>
            )}
          </div>
        </section>
      </div>
      <ModuleChat
        module="security"
        label="SEGURANCA"
        color={PRIMARY}
        welcome="Posso auditar suas contas, verificar vazamentos de dados, sugerir melhorias de seguranca e ajudar a configurar 2FA. O que precisa?"
        suggestions={["Auditar minhas contas", "Verificar vazamentos", "Como melhorar 2FA", "Senhas fracas"]}
      />
    </ModuleShell>
  );
}

function Metric(props: { label: string; value: string; color: string }): JSX.Element {
  return (
    <div className="security-metric" style={{ borderColor: `${props.color}33` }}>
      <span className="hud-label" style={{ color: props.color }}>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}
