import mongoose, { Schema, Document } from 'mongoose';

export interface ICandle extends Document {
  symbol: string;
  timeframe: '1s' | '1m' | '5m';
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  createdAt: Date;
}

const CandleSchema = new Schema<ICandle>({
  symbol: { type: String, required: true, index: true },
  timeframe: { type: String, required: true, enum: ['1s', '1m', '5m'], index: true },
  time: { type: Number, required: true, index: true },
  open: { type: Number, required: true },
  high: { type: Number, required: true },
  low: { type: Number, required: true },
  close: { type: Number, required: true },
  volume: { type: Number },
  createdAt: { type: Date, default: Date.now }
});

// Compound index for efficient queries
CandleSchema.index({ symbol: 1, timeframe: 1, time: 1 }, { unique: true });

export default mongoose.model<ICandle>('Candle', CandleSchema);
