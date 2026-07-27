const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { actionLimiter } = require('../middleware/rateLimit');

const router = express.Router();
const GIFT_TYPES = {
  ruza: '🌹 Ruža', srce: '❤️ Srce', dijamant: '💎 Dijamant',
  medvjedic: '🧸 Medvjedić', sampanjac: '🍾 Šampanjac',
};

// ============================================
// GET /api/gifts/types
// ============================================
router.get('/types', requireAuth, (req, res) => {
  res.json({ types: GIFT_TYPES });
});

// ============================================
// POST /api/gifts  { toNick, giftType, message }
// ============================================
router.post('/', requireAuth, actionLimiter, async (req, res) => {
  const toNick = String(req.body.toNick || '').trim();
  const giftType = req.body.giftType;
  const message = String(req.body.message || '').trim().slice(0, 300);

  if (!GIFT_TYPES[giftType]) return res.status(400).json({ error: 'Nepoznat tip poklona.' });

  const toUser = await db.query('SELECT id FROM users WHERE nick = $1', [toNick]);
  if (toUser.rows.length === 0) return res.status(404).json({ error: 'Korisnik ne postoji.' });
  if (toUser.rows[0].id === req.user.userId) return res.status(400).json({ error: 'Ne možete poslati poklon sami sebi.' });

  await db.query(
    'INSERT INTO gifts (from_user_id, to_user_id, gift_type, message) VALUES ($1, $2, $3, $4)',
    [req.user.userId, toUser.rows[0].id, giftType, message || null]
  );

  const me = await db.query('SELECT nick FROM users WHERE id = $1', [req.user.userId]);
  await db.query(
    'INSERT INTO notifications (user_id, type, text, from_nick) VALUES ($1, $2, $3, $4)',
    [toUser.rows[0].id, 'gift', `${me.rows[0].nick} vam je poslao/la poklon: ${GIFT_TYPES[giftType]}`, me.rows[0].nick]
  );

  res.json({ ok: true });
});

// ============================================
// GET /api/gifts/received | /sent
// ============================================
router.get('/received', requireAuth, async (req, res) => {
  const result = await db.query(
    `SELECT g.id, g.gift_type, g.message, g.created_at, u.nick AS from_nick
     FROM gifts g JOIN users u ON u.id = g.from_user_id
     WHERE g.to_user_id = $1 ORDER BY g.created_at DESC LIMIT 100`,
    [req.user.userId]
  );
  res.json({ gifts: result.rows });
});
router.get('/sent', requireAuth, async (req, res) => {
  const result = await db.query(
    `SELECT g.id, g.gift_type, g.message, g.created_at, u.nick AS to_nick
     FROM gifts g JOIN users u ON u.id = g.to_user_id
     WHERE g.from_user_id = $1 ORDER BY g.created_at DESC LIMIT 100`,
    [req.user.userId]
  );
  res.json({ gifts: result.rows });
});

module.exports = router;
