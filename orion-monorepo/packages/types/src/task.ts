export type TaskStatus = "todo" | "doing" | "done" | "archived";
export type EnergyLevel = 1 | 2 | 3;
export type Priority = 1 | 2 | 3;
export type RecurrenceRule = "daily" | "weekly" | "monthly" | "weekdays";

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
  parentId: string | null;
  isRecurring: boolean;
  recurrenceRule: RecurrenceRule | null;
  completedAt: string | null;
  subtasks?: Task[];
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
  parentId?: string;
  isRecurring?: boolean;
  recurrenceRule?: RecurrenceRule;
}

export interface TaskUpdateInput extends Partial<TaskCreateInput> {
  id: string;
}
