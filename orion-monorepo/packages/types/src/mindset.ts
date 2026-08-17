export interface MindsetCheckinInput {
  mood: number;
  energy: number;
  stress: number;
  note?: string;
}

export interface MindsetCheckinResult {
  id: string;
  pattern: string;
  mood: number;
  energy: number;
  stress: number;
  intervention: string;
  reframe: string;
  nextAction: string;
  createdAt: string;
}
