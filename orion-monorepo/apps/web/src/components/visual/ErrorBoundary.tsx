import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary global do ORION — captura crashes React e exibe
 * fallback HUD sci-fi em vez de tela branca.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false, error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    // Em produção, aqui vai o Sentry/LogRocket
    console.error("[ORION] Crash capturado:", error, errorInfo);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  override render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div style={{
        minHeight: "100vh",
        background: "#030509",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Share Tech Mono', monospace",
        color: "#00D4FF",
        padding: "2rem",
      }}>
        <div style={{
          maxWidth: 560,
          width: "100%",
          border: "1px solid rgba(0, 212, 255, 0.2)",
          borderRadius: 12,
          padding: "2.5rem",
          background: "rgba(0, 212, 255, 0.03)",
          backdropFilter: "blur(8px)",
        }}>
          {/* Status indicator */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 24,
          }}>
            <div style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "#FF4444",
              boxShadow: "0 0 12px #FF444480",
              animation: "orion-error-pulse 2s ease-in-out infinite",
            }} />
            <span style={{ fontSize: 11, letterSpacing: "0.3em", color: "#FF6B6B" }}>
              SYSTEM FAULT DETECTED
            </span>
          </div>

          {/* Title */}
          <h1 style={{
            fontSize: 20,
            fontWeight: 400,
            margin: "0 0 8px",
            fontFamily: "'Rajdhani', sans-serif",
            letterSpacing: "0.05em",
          }}>
            Módulo Desconectado
          </h1>

          <p style={{
            fontSize: 13,
            color: "rgba(0, 212, 255, 0.6)",
            lineHeight: 1.6,
            margin: "0 0 24px",
          }}>
            Um componente encontrou um erro inesperado. O núcleo permanece estável.
          </p>

          {/* Error details */}
          {this.state.error && (
            <div style={{
              background: "rgba(255, 68, 68, 0.05)",
              border: "1px solid rgba(255, 68, 68, 0.15)",
              borderRadius: 8,
              padding: "12px 16px",
              marginBottom: 24,
              fontSize: 12,
              color: "#FF8888",
              maxHeight: 120,
              overflow: "auto",
              wordBreak: "break-word",
            }}>
              <div style={{ marginBottom: 4, color: "#FF6B6B", fontWeight: 600 }}>
                {this.state.error.name}
              </div>
              {this.state.error.message}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={this.handleReset}
              style={{
                flex: 1,
                padding: "10px 16px",
                background: "transparent",
                border: "1px solid rgba(0, 212, 255, 0.3)",
                borderRadius: 8,
                color: "#00D4FF",
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: 12,
                letterSpacing: "0.1em",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(0, 212, 255, 0.1)";
                e.currentTarget.style.borderColor = "rgba(0, 212, 255, 0.5)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = "rgba(0, 212, 255, 0.3)";
              }}
            >
              ↻ RECONECTAR
            </button>
            <button
              onClick={this.handleReload}
              style={{
                flex: 1,
                padding: "10px 16px",
                background: "rgba(0, 212, 255, 0.15)",
                border: "1px solid rgba(0, 212, 255, 0.4)",
                borderRadius: 8,
                color: "#00D4FF",
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: 12,
                letterSpacing: "0.1em",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(0, 212, 255, 0.25)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(0, 212, 255, 0.15)";
              }}
            >
              ⟲ REINICIAR
            </button>
          </div>

          {/* Keyframes via style tag */}
          <style>{`
            @keyframes orion-error-pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.3; }
            }
          `}</style>
        </div>
      </div>
    );
  }
}
