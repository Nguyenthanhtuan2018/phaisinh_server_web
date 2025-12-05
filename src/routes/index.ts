import { Router } from 'express';
import candleRoutes from './candles';
import waveRoutes from './waves';
import intradayRoutes from './intraday';

const router = Router();

router.use('/candles', candleRoutes);
router.use('/waves', waveRoutes);
router.use('/intraday', intradayRoutes);

export default router;
