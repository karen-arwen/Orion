export interface SocialContactInput {
  name: string;
  context?: string;
  lastInteraction?: string;
  nextStep?: string;
  importance?: number;
}

export interface SocialContact {
  id: string;
  name: string;
  context: string;
  lastInteraction: string | null;
  nextStep: string;
  importance: number;
  createdAt: string;
  updatedAt: string;
}

export interface SocialNudge {
  contactId: string;
  name: string;
  reason: string;
  messageDraft: string;
}
