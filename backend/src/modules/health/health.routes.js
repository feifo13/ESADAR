import { Router } from 'express';
import { pool } from '../../db/pool.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT 1 AS ok');
    return res.json({ ok: true, db: rows[0]?.ok === 1 });
  } catch (error) {
    return next(error);
  }
});

export default router;
