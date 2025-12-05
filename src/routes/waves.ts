import { Router, Request, Response } from 'express';
import WaveAnalysis from '../models/WaveAnalysis';

const router = Router();

// Get wave analyses
router.get('/', async (req: Request, res: Response) => {
  try {
    const { symbol, from, to, limit = 50 } = req.query;

    const query: any = {};
    if (symbol) query.symbol = symbol;
    if (from || to) {
      query.startTime = {};
      if (from) query.startTime.$gte = parseInt(from as string);
      if (to) query.startTime.$lte = parseInt(to as string);
    }

    const analyses = await WaveAnalysis.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit as string))
      .lean();

    res.json({ success: true, data: analyses });
  } catch (error) {
    console.error('Error fetching wave analyses:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch analyses' });
  }
});

// Save wave analysis
router.post('/', async (req: Request, res: Response) => {
  try {
    const analysis = new WaveAnalysis(req.body);
    await analysis.save();

    res.json({ success: true, data: analysis });
  } catch (error) {
    console.error('Error saving wave analysis:', error);
    res.status(500).json({ success: false, error: 'Failed to save analysis' });
  }
});

// Get analysis by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const analysis = await WaveAnalysis.findById(req.params.id).lean();
    
    if (!analysis) {
      return res.status(404).json({ success: false, error: 'Analysis not found' });
    }

    res.json({ success: true, data: analysis });
  } catch (error) {
    console.error('Error fetching analysis:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch analysis' });
  }
});

// Delete analysis
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const result = await WaveAnalysis.findByIdAndDelete(req.params.id);
    
    if (!result) {
      return res.status(404).json({ success: false, error: 'Analysis not found' });
    }

    res.json({ success: true, message: 'Analysis deleted' });
  } catch (error) {
    console.error('Error deleting analysis:', error);
    res.status(500).json({ success: false, error: 'Failed to delete analysis' });
  }
});

export default router;
