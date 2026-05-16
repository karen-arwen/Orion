import { useState } from "react";
import type { OrionModule, ModuleCategory } from "@orion/types";
import { ALL_MODULES, MODULE_CATS } from "../../lib/constants.js";

interface ModuleGridProps {
  primaryColor: string;
  activeModule: OrionModule | null;
  onModuleClick: (mod: OrionModule) => void;
}

const CAT_ORDER: ModuleCategory[] = ["core", "growth", "wellness", "create", "explore", "system"];

const modulesByCat = (cat: ModuleCategory): OrionModule[] =>
  ALL_MODULES.filter((m) => m.cat === cat);

export function ModuleGrid({
  primaryColor,
  activeModule,
  onModuleClick,
}: ModuleGridProps): JSX.Element {
  const [expandedCat, setExpandedCat] = useState<ModuleCategory | null>("core");

  return (
    <div className="flex-1 overflow-y-auto">
      {CAT_ORDER.map((catId) => {
        const cat = MODULE_CATS[catId];
        if (!cat) return null;
        const mods = modulesByCat(catId);
        const isExp = expandedCat === catId;
        return (
          <div key={catId} style={{ marginBottom: 2 }}>
            <button
              onClick={() => setExpandedCat(isExp ? null : catId)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 12px",
                background: "transparent",
                border: "none",
                borderBottom: `1px solid ${isExp ? cat.color + "30" : "rgba(255,255,255,0.03)"}`,
                cursor: "pointer",
              }}
            >
              <span
                className="hud-label"
                style={{ fontSize: 8, color: cat.color }}
              >
                {cat.label}
              </span>
              <span style={{ marginLeft: "auto", fontSize: 9, color: "rgba(255,255,255,0.12)" }}>
                {isExp ? "▲" : "▼"}
              </span>
            </button>
            {isExp && (
              <div style={{ display: "flex", flexDirection: "column", gap: 1, padding: "4px 6px" }}>
                {mods.map((mod) => {
                  const isSel = activeModule?.id === mod.id;
                  return (
                    <button
                      key={mod.id}
                      onClick={() => onModuleClick(mod)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 9,
                        padding: "8px 10px",
                        background: isSel ? `${primaryColor}12` : "transparent",
                        border: `1px solid ${isSel ? primaryColor + "40" : "transparent"}`,
                        borderRadius: 6,
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 15,
                          color: isSel ? primaryColor : "rgba(255,255,255,0.25)",
                          filter: isSel ? `drop-shadow(0 0 6px ${primaryColor})` : "none",
                          minWidth: 18,
                          textAlign: "center",
                        }}
                      >
                        {mod.icon}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          className="hud-label"
                          style={{
                            fontSize: 10,
                            color: isSel ? primaryColor : "rgba(255,255,255,0.44)",
                            letterSpacing: "0.08em",
                          }}
                        >
                          {mod.label}
                        </div>
                        <div
                          style={{
                            fontSize: 9,
                            color: "rgba(255,255,255,0.15)",
                            marginTop: 1,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {mod.sub}
                        </div>
                      </div>
                      {mod.hasReal && (
                        <div
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: "50%",
                            background: "#10B981",
                            boxShadow: "0 0 5px #10B981",
                            flexShrink: 0,
                          }}
                        />
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
