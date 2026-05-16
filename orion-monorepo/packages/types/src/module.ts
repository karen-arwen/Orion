export type ModuleCategory =
  | "core"
  | "growth"
  | "wellness"
  | "create"
  | "explore"
  | "system";

export type ModuleId =
  | "comms"
  | "calendar"
  | "life"
  | "know"
  | "career"
  | "finance"
  | "health"
  | "focus"
  | "habit"
  | "sleep"
  | "creative"
  | "entert"
  | "gaming"
  | "chef"
  | "travel"
  | "news"
  | "social"
  | "shop"
  | "sec"
  | "auto"
  | "docs"
  | "iot"
  | "whatif"
  | "lang"
  | "mindset"
  | "plugin";

export interface OrionModule {
  id: ModuleId;
  icon: string;
  label: string;
  sub: string;
  cat: ModuleCategory;
  hasReal: boolean;
}

export interface UserModule {
  userId: string;
  moduleId: ModuleId;
  enabled: boolean;
  config: Record<string, unknown>;
  lastUsed: string | null;
}

export interface ModuleCategoryMeta {
  label: string;
  color: string;
}
