export type TaskStatus = "todo" | "doing" | "done" | "archived";

/** 1 = baixa energia, 2 = normal, 3 = energia alta requerida */
export type EnergyLevel = 1 | 2 | 3;

/** 1 = baixa, 2 = normal, 3 = alta */
export type Priority = 1 | 2 | 3;

export interface Task {
  id: string;
  userId: string;
  title: string;
  notes: string | null;
  status: TaskStatus;
  energy: EnergyLevel;
  priority: Priority;
  scheduledFor: string | null;
  dueAt: string | null;
  estMinutes: number | null;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskCreateInput {
  title: string;
  notes?: string;
  status?: TaskStatus;
  energy?: EnergyLevel;
  priority?: Priority;
  scheduledFor?: string;
  dueAt?: string;
  estMinutes?: number;
  projectId?: string;
}

export interface TaskUpdateInput extends Partial<TaskCreateInput> {
  id: string;
}
