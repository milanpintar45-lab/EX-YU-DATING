const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const ALLOWED_KEYS = ['hero-hr', 'hero-ba', 'hero-rs', 'above-chat-hr', 'above-chat-ba', 'above-chat-rs'];

// ============================================
// GET /api/site-assets/:key - javno, bilo koji prijavljeni korisnik može pročitati
// ============================================
router.get('/:key', requireAuth, async (req, res) => {
  if (!ALLOWED_KEYS.includes(req.params.key)) return res.status(400).json({ error: 'Nepoznat ključ.' });
  const result = await db.query('SELECT data_url, updated_at FROM site_assets WHERE key = $1', [req.params.key]);
  if (result.rows.length === 0) return res.json({ dataUrl: null });
  res.json({ dataUrl: result.rows[0].data_url, updatedAt: result.rows[0].updated_at });
});

// ============================================
// PUT /api/site-assets/:key - SAMO ADMIN - drag&drop sprema ovdje
// ============================================
router.put('/:key', requireAuth, requireAdmin, async (req, res) => {
  if (!ALLOWED_KEYS.includes(req.params.key)) return res.status(400).json({ error: 'Nepoznat ključ.' });
  const dataUrl = req.body.dataUrl;
  if (!dataUrl || typeof dataUrl !== 'string') return res.status(400).json({ error: 'Nedostaje slika.' });
  if (dataUrl.length > 8 * 1024 * 1024) return res.status(400).json({ error: 'Slika je prevelika (max ~6MB).' });

  await db.query(
    `INSERT INTO site_assets (key, data_url, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET data_url = $2, updated_at = now()`,
    [req.params.key, dataUrl]
  );
  res.json({ ok: true });
});

module.exports = router;
