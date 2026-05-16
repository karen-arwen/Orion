export type ProjectStatus =
  | "ideacao"
  | "conceito"
  | "em_build"
  | "design_ok"
  | "mvp_live"
  | "crescendo"
  | "pausado"
  | "concluido";

export interface Project {
  id: string;
  userId: string;
  name: string;
  color: string;
  progress: number;
  status: ProjectStatus | string;
  createdAt: string;
  updatedAt: string;
}
