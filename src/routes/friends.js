const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { actionLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// ============================================
// POST /api/friends/request  { toNick }
// ============================================
router.post('/request', requireAuth, actionLimiter, async (req, res) => {
  const toNick = String(req.body.toNick || '').trim();
  const toUser = await db.query('SELECT id FROM users WHERE nick = $1', [toNick]);
  if (toUser.rows.length === 0) return res.status(404).json({ error: 'Korisnik ne postoji.' });
  const toId = toUser.rows[0].id;
  if (toId === req.user.userId) return res.status(400).json({ error: 'Ne možete poslati zahtjev sami sebi.' });

  // Ako već postoji obrnuti zahtjev na čekanju, prihvati ga umjesto stvaranja duplikata
  const reverse = await db.query(
    `SELECT id FROM friend_requests WHERE from_user_id = $1 AND to_user_id = $2 AND status = 'pending'`,
    [toId, req.user.userId]
  );
  if (reverse.rows.length > 0) {
    await db.query(`UPDATE friend_requests SET status = 'accepted' WHERE id = $1`, [reverse.rows[0].id]);
    return res.json({ ok: true, autoAccepted: true });
  }

  try {
    await db.query(
      'INSERT INTO friend_requests (from_user_id, to_user_id) VALUES ($1, $2)',
      [req.user.userId, toId]
    );
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Zahtjev je već poslan.' });
    throw err;
  }

  const me = await db.query('SELECT nick FROM users WHERE id = $1', [req.user.userId]);
  await db.query(
    'INSERT INTO notifications (user_id, type, text, from_nick) VALUES ($1, $2, $3, $4)',
    [toId, 'friend_request', `${me.rows[0].nick} vam je poslao/la zahtjev za prijateljstvo 🤝`, me.rows[0].nick]
  );

  res.json({ ok: true });
});

// ============================================
// GET /api/friends/requests - dolazni zahtjevi na čekanju
// ============================================
router.get('/requests', requireAuth, async (req, res) => {
  const result = await db.query(
    `SELECT fr.id, u.nick AS from_nick, fr.created_at
     FROM friend_requests fr JOIN users u ON u.id = fr.from_user_id
     WHERE fr.to_user_id = $1 AND fr.status = 'pending' ORDER BY fr.created_at DESC`,
    [req.user.userId]
  );
  res.json({ requests: result.rows });
});

// ============================================
// POST /api/friends/requests/:id/accept | /decline
// ============================================
router.post('/requests/:id/accept', requireAuth, async (req, res) => {
  const result = await db.query(
    `UPDATE friend_requests SET status = 'accepted' WHERE id = $1 AND to_user_id = $2 RETURNING id`,
    [req.params.id, req.user.userId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Zahtjev ne postoji.' });
  res.json({ ok: true });
});
router.post('/requests/:id/decline', requireAuth, async (req, res) => {
  const result = await db.query(
    `UPDATE friend_requests SET status = 'declined' WHERE id = $1 AND to_user_id = $2 RETURNING id`,
    [req.params.id, req.user.userId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Zahtjev ne postoji.' });
  res.json({ ok: true });
});

// ============================================
// GET /api/friends - lista prihvaćenih prijatelja
// ============================================
router.get('/', requireAuth, async (req, res) => {
  const result = await db.query(
    `SELECT u.nick FROM friend_requests fr
     JOIN users u ON u.id = (CASE WHEN fr.from_user_id = $1 THEN fr.to_user_id ELSE fr.from_user_id END)
     WHERE (fr.from_user_id = $1 OR fr.to_user_id = $1) AND fr.status = 'accepted'`,
    [req.user.userId]
  );
  res.json({ friends: result.rows.map((r) => r.nick) });
});

module.exports = router;
