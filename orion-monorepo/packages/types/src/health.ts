export interface EnergyLog {
  id: string;
  userId: string;
  value: number;
  note: string | null;
  createdAt: string;
}

export interface EnergyPattern {
  label: string;
  hour: number;
  average: number;
  confidence: number;
  sampleSize: number;
}

export interface EnergySummary {
  today: EnergyLog[];
  week: EnergyLog[];
  lowEnergyPattern: EnergyPattern | null;
  peakEnergyPattern: EnergyPattern | null;
  recommendation: string;
}

export interface EnergyLogInput {
  value: number;
  note?: string;
  createdAt?: string;
}
