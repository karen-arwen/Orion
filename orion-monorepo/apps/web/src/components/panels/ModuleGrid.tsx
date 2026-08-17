import { useMemo, useState } from "react";
import type { OrionModule, ModuleCategory } from "@orion/types";
import { ALL_MODULES, MODULE_CATS } from "../../lib/constants.js";

interface ModuleGridProps {
  primaryColor: string;
  activeModule: OrionModule | null;
  onModuleClick: (mod: OrionModule) => void;
}

const CAT_ORDER: ModuleCategory[] = ["core", "growth", "wellness", "create", "explore", "system"];

/* ═══════════════════════════════════════════════════════════════════
   ModuleGrid — sidebar das categorias + modulos.

   Refeito: contador por categoria + sub texto, hover com slide,
   indicador de modulo ativo expandido automaticamente, item ativo
   com left bar pulsante, "hasReal" passa a ser badge LIVE.
═══════════════════════════════════════════════════════════════════ */

const CAT_DESCRIPTIONS: Record<ModuleCategory, string> = {
  core: "Comms · Agenda · Life",
  growth: "Carreira · CFO · Idiomas",
  wellness: "Saude · Sono · Mindset",
  create: "Midia · Gaming · Chef",
  explore: "Radar · Travel · Social",
  system: "Docs · Dev · Sec · Auto",
};

const CAT_ICONS: Record<ModuleCategory, string> = {
  core: "◈",
  growth: "▲",
  wellness: "♡",
  create: "✦",
  explore: "◌",
  system: "◇",
};

export function ModuleGrid({
  primaryColor,
  activeModule,
  onModuleClick,
}: ModuleGridProps): JSX.Element {
  const initialExpanded = useMemo<ModuleCategory>(() => {
    if (activeModule) {
      const found = ALL_MODULES.find((m) => m.id === activeModule.id);
      if (found) return found.cat;
    }
    return "core";
  }, [activeModule]);

  const [expandedCat, setExpandedCat] = useState<ModuleCategory | null>(initialExpanded);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const modulesByCat = (cat: ModuleCategory): OrionModule[] =>
    ALL_MODULES.filter((m) => m.cat === cat);

  return (
    <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
      {CAT_ORDER.map((catId) => {
        const cat = MODULE_CATS[catId];
        if (!cat) return null;
        const mods = modulesByCat(catId);
        const isExp = expandedCat === catId;
        const hasActive = activeModule && mods.some((m) => m.id === activeModule.id);

        return (
          <div key={catId} style={{ marginBottom: 1 }}>
            {/* Category header */}
            <button
              onClick={() => setExpandedCat(isExp ? null : catId)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 12px",
                background: isExp ? `${cat.color}08` : "transparent",
                border: "none",
                borderBottom: `1px solid ${isExp ? cat.color + "33" : "rgba(255,255,255,0.025)"}`,
                cursor: "pointer",
                transition: "background 180ms ease",
                position: "relative",
              }}
              onMouseEnter={(e) => { if (!isExp) e.currentTarget.style.background = "rgba(255,255,255,0.018)"; }}
              onMouseLeave={(e) => { if (!isExp) e.currentTarget.style.background = "transparent"; }}
            >
              {/* Left accent bar quando expandida */}
              {isExp && (
                <div style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  background: cat.color,
                  boxShadow: `0 0 8px ${cat.color}`,
                }} />
              )}

              <span style={{
                fontSize: 12,
                color: isExp ? cat.color : "rgba(255,255,255,0.32)",
                textShadow: isExp ? `0 0 6px ${cat.color}AA` : "none",
                minWidth: 14,
                textAlign: "center",
                transition: "all 180ms ease",
              }}>
                {CAT_ICONS[catId]}
              </span>

              <div style={{ flex: 1, textAlign: "left" }}>
                <div
                  className="hud-label"
                  style={{
                    fontSize: 8.5,
                    color: isExp ? cat.color : "rgba(255,255,255,0.45)",
                    letterSpacing: "0.2em",
                    fontWeight: isExp ? 700 : 500,
                    transition: "color 180ms ease",
                  }}
                >
                  {cat.label}
                </div>
                <div style={{
                  fontSize: 8,
                  color: isExp ? "rgba(255,255,255,0.32)" : "rgba(255,255,255,0.16)",
                  letterSpacing: "0.04em",
                  marginTop: 1,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}>
                  {CAT_DESCRIPTIONS[catId]}
                </div>
              </div>

              {/* Contador */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "2px 6px",
                background: isExp ? `${cat.color}18` : "rgba(255,255,255,0.02)",
                border: `1px solid ${isExp ? cat.color + "44" : "rgba(255,255,255,0.04)"}`,
                borderRadius: 3,
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: 9,
                color: isExp ? cat.color : "rgba(255,255,255,0.3)",
                letterSpacing: "0.04em",
                transition: "all 180ms ease",
              }}>
                {mods.length}
                {hasActive && !isExp && (
                  <span style={{
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: cat.color,
                    boxShadow: `0 0 4px ${cat.color}`,
                  }} />
                )}
              </div>

              {/* Chevron */}
              <span style={{
                fontSize: 9,
                color: isExp ? cat.color : "rgba(255,255,255,0.18)",
                transform: isExp ? "rotate(0deg)" : "rotate(-90deg)",
                transition: "transform 200ms ease",
                marginLeft: 2,
              }}>
                ▾
              </span>
            </button>

            {/* Expandable list */}
            {isExp && (
              <div style={{
                display: "flex",
                flexDirection: "column",
                gap: 1,
                padding: "5px 6px 8px 6px",
                animation: "fadeUp 0.2s ease both",
              }}>
                {mods.map((mod) => {
                  const isSel = activeModule?.id === mod.id;
                  const isHovered = hoveredId === mod.id;
                  const accentColor = isSel ? primaryColor : cat.color;

                  return (
                    <button
                      key={mod.id}
                      onClick={() => onModuleClick(mod)}
                      onMouseEnter={() => setHoveredId(mod.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 9,
                        padding: "8px 10px",
                        background: isSel
                          ? `linear-gradient(90deg, ${primaryColor}1A, transparent 80%)`
                          : isHovered
                          ? `${cat.color}08`
                          : "transparent",
                        border: `1px solid ${isSel ? primaryColor + "55" : isHovered ? cat.color + "22" : "transparent"}`,
                        borderLeft: isSel ? `2px solid ${primaryColor}` : isHovered ? `2px solid ${cat.color}44` : "2px solid transparent",
                        borderRadius: 6,
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 150ms ease",
                        position: "relative",
                        boxShadow: isSel ? `0 0 8px ${primaryColor}22, inset 0 0 6px ${primaryColor}10` : "none",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 15,
                          color: isSel ? primaryColor : isHovered ? cat.color : "rgba(255,255,255,0.3)",
                          filter: isSel ? `drop-shadow(0 0 6px ${primaryColor})` : isHovered ? `drop-shadow(0 0 3px ${cat.color}99)` : "none",
                          minWidth: 18,
                          textAlign: "center",
                          transition: "all 150ms ease",
                        }}
                      >
                        {mod.icon}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          className="hud-label"
                          style={{
                            fontSize: 10,
                            color: isSel ? primaryColor : isHovered ? "rgba(255,255,255,0.78)" : "rgba(255,255,255,0.5)",
                            letterSpacing: "0.1em",
                            fontWeight: isSel ? 700 : 500,
                            textShadow: isSel ? `0 0 6px ${primaryColor}66` : "none",
                          }}
                        >
                          {mod.label}
                        </div>
                        <div
                          style={{
                            fontSize: 8.5,
                            color: isSel ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.2)",
                            marginTop: 1,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            letterSpacing: "0.04em",
                          }}
                        >
                          {mod.sub}
                        </div>
                      </div>
                      {mod.hasReal && (
                        <div
                          title="API real conectada"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 3,
                            padding: "1px 4px",
                            background: "rgba(16,185,129,0.12)",
                            border: "1px solid rgba(16,185,129,0.35)",
                            borderRadius: 2,
                            fontSize: 7,
                            color: "#10B981",
                            fontFamily: "'Share Tech Mono', monospace",
                            fontWeight: 700,
                            letterSpacing: "0.12em",
                            boxShadow: "0 0 4px rgba(16,185,129,0.4)",
                            flexShrink: 0,
                          }}
                        >
                          <span style={{
                            width: 4,
                            height: 4,
                            borderRadius: "50%",
                            background: "#10B981",
                            boxShadow: "0 0 4px #10B981",
                          }} />
                          LIVE
                        </div>
                      )}
                      {!mod.hasReal && isHovered && (
                        <span style={{
                          fontSize: 9,
                          color: "rgba(255,255,255,0.18)",
                          letterSpacing: "0.1em",
                          fontFamily: "'Share Tech Mono', monospace",
                          flexShrink: 0,
                        }}>
                          →
                        </span>
                      )}

                      {/* Active indicator: barra superior animada */}
                      {isSel && (
                        <span style={{
                          position: "absolute",
                          top: 0,
                          left: 8,
                          right: 8,
                          height: 1,
                          background: `linear-gradient(90deg, transparent, ${primaryColor}99, transparent)`,
                          animation: "shimmer 2.5s ease-in-out infinite",
                        }} />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
