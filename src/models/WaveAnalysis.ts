import mongoose, { Schema, Document } from 'mongoose';

export interface IWaveAnalysis extends Document {
  userId?: string;
  symbol: string;
  timeframe: '1s' | '1m' | '5m';
  startTime: number;
  endTime: number;
  direction: 'UP' | 'DOWN' | 'FLAT';
  points: {
    A: { x: number; y: number };
    B: { x: number; y: number };
    C: { x: number; y: number };
    D: { x: number; y: number };
    E: { x: number; y: number };
    F: { x: number; y: number };
    G: { x: number; y: number };
    H: { x: number; y: number };
    I: { x: number; y: number };
  };
  ratios: Record<string, number>;
  status: 'continuation' | 'reversal' | null;
  ruleProfile: string;
  createdAt: Date;
}

const WaveAnalysisSchema = new Schema<IWaveAnalysis>({
  userId: { type: String, index: true },
  symbol: { type: String, required: true, index: true },
  timeframe: { type: String, required: true, enum: ['1s', '1m', '5m'] },
  startTime: { type: Number, required: true },
  endTime: { type: Number, required: true },
  direction: { type: String, required: true, enum: ['UP', 'DOWN', 'FLAT'] },
  points: {
    A: { x: Number, y: Number },
    B: { x: Number, y: Number },
    C: { x: Number, y: Number },
    D: { x: Number, y: Number },
    E: { x: Number, y: Number },
    F: { x: Number, y: Number },
    G: { x: Number, y: Number },
    H: { x: Number, y: Number },
    I: { x: Number, y: Number }
  },
  ratios: { type: Map, of: Number },
  status: { type: String, enum: ['continuation', 'reversal', null] },
  ruleProfile: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

WaveAnalysisSchema.index({ symbol: 1, startTime: 1, endTime: 1 });

export default mongoose.model<IWaveAnalysis>('WaveAnalysis', WaveAnalysisSchema);
