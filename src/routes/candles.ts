import { Router, Request, Response } from 'express';
import Candle from '../models/Candle';

const router = Router();

// Get candles by symbol and timeframe
router.get('/:symbol/:timeframe', async (req: Request, res: Response) => {
  try {
    const { symbol, timeframe } = req.params;
    const { from, to, limit = 1000 } = req.query;

    const query: any = { symbol, timeframe };
    
    if (from || to) {
      query.time = {};
      if (from) query.time.$gte = parseInt(from as string);
      if (to) query.time.$lte = parseInt(to as string);
    }

    const candles = await Candle.find(query)
      .sort({ time: 1 })
      .limit(parseInt(limit as string))
      .lean();

    res.json({
      success: true,
      data: candles.map(c => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume
      }))
    });
  } catch (error) {
    console.error('Error fetching candles:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch candles' });
  }
});

// Bulk insert candles (for import)
router.post('/bulk', async (req: Request, res: Response) => {
  try {
    const { symbol, timeframe, candles } = req.body;

    if (!symbol || !timeframe || !Array.isArray(candles)) {
      return res.status(400).json({ success: false, error: 'Invalid request body' });
    }

    const operations = candles.map(candle => ({
      updateOne: {
        filter: { symbol, timeframe, time: candle.time },
        update: { $set: { ...candle, symbol, timeframe } },
        upsert: true
      }
    }));

    const result = await Candle.bulkWrite(operations);

    res.json({
      success: true,
      inserted: result.upsertedCount,
      updated: result.modifiedCount
    });
  } catch (error) {
    console.error('Error bulk inserting candles:', error);
    res.status(500).json({ success: false, error: 'Failed to insert candles' });
  }
});

export default router;
