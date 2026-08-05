const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { getRegion } = require('../utils/geo');
const router = express.Router();
const ALLOWED_COUNTRIES = ['hr', 'ba', 'rs'];

function normalizeStr(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// ============================================
// GET /api/country-chat?country=hr&county=...&limit=50
// ============================================
router.get('/', requireAuth, async (req, res) => {
  const country = req.query.country;
  if (!ALLOWED_COUNTRIES.includes(country)) {
    return res.status(400).json({ error: 'Nepoznata država.' });
  }
  const county = req.query.county;
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const result = await db.query(
    `SELECT cc.id, cc.body, cc.created_at, cc.county AS saved_county, cc.from_user_id, u.nick AS who, u.city
     FROM country_chat_messages cc JOIN users u ON u.id = cc.from_user_id
     WHERE cc.country = $1
     ORDER BY cc.created_at DESC LIMIT 200`,
    [country]
  );
  let rows = result.rows;
  if (county && county !== 'SVI') {
    const target = normalizeStr(county);
    rows = rows.filter(m => normalizeStr(m.saved_county) === target);
  }
  rows = rows.slice(0, limit);
  const messages = rows.reverse().map((m) => ({
    ...m,
    region: m.saved_county || getRegion(country, m.city),
  }));
  res.json({ messages });
});

// ============================================
// POST /api/country-chat  { country, county, body }
// ============================================
router.post('/', requireAuth, async (req, res) => {
  const { country, county, body } = req.body;
  if (!ALLOWED_COUNTRIES.includes(country)) {
    return res.status(400).json({ error: 'Nepoznata država.' });
  }
  const text = String(body || '').trim();
  if (!text) return res.status(400).json({ error: 'Prazna poruka.' });
  if (text.length > 1000) return res.status(400).json({ error: 'Poruka je predugačka.' });
  const countyValue = (county && county !== 'SVI') ? String(county) : null;
  await db.query(
    'INSERT INTO country_chat_messages (country, from_user_id, body, county) VALUES ($1, $2, $3, $4)',
    [country, req.user.userId, text, countyValue]
  );
  res.json({ ok: true });
});

// ============================================
// DELETE /api/country-chat/:id
// ============================================
router.delete('/:id', requireAuth, async (req, res) => {
  const id = req.params.id;
  const result = await db.query(
    'DELETE FROM country_chat_messages WHERE id = $1 AND from_user_id = $2 RETURNING id',
    [id, req.user.userId]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Poruka nije pronađena ili nemate dozvolu za brisanje.' });
  }
  res.json({ ok: true });
});

module.exports = router;