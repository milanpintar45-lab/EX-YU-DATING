const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { actionLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.post('/start', requireAuth, actionLimiter, async (req, res) => {
  const toNick = String(req.body.toNick || '').trim();
  const toUser = await db.query('SELECT id FROM users WHERE nick = $1', [toNick]);
  if (toUser.rows.length === 0) return res.status(404).json({ error: 'Korisnik ne postoji.' });
  if (toUser.rows[0].id === req.user.userId) {
    return res.status(400).json({ error: 'Ne možete pozvati sami sebe.' });
  }

  const blocked = await db.query(
    'SELECT 1 FROM blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)',
    [req.user.userId, toUser.rows[0].id]
  );
  if (blocked.rows.length > 0) {
    return res.status(400).json({ error: 'Ne možete pozvati blokiranog korisnika.' });
  }

  const me = await db.query('SELECT nick FROM users WHERE id = $1', [req.user.userId]);
  const meNick = me.rows[0].nick;

  const cleanA = meNick.replace(/[^a-zA-Z0-9]/g, '');
  const cleanB = toNick.replace(/[^a-zA-Z0-9]/g, '');
  const room = 'exyudate-1on1-' + (cleanA < cleanB ? cleanA + '-' + cleanB : cleanB + '-' + cleanA) + '-' + Math.random().toString(36).substring(2, 6);

  const result = await db.query(
    'INSERT INTO calls (from_user_id, to_user_id, room, status) VALUES ($1, $2, $3, $4) RETURNING id',
    [req.user.userId, toUser.rows[0].id, room, 'ringing']
  );

  res.json({ ok: true, callId: result.rows[0].id, room, fromNick: meNick });
});

router.get('/incoming', requireAuth, async (req, res) => {
  const result = await db.query(
    `SELECT c.id, c.room, c.created_at, u.nick AS from_nick
     FROM calls c JOIN users u ON u.id = c.from_user_id
     WHERE c.to_user_id = $1 AND c.status = 'ringing' AND c.created_at > now() - interval '35 seconds'
     ORDER BY c.created_at DESC LIMIT 1`,
    [req.user.userId]
  );
  if (result.rows.length === 0) return res.json({ call: null });
  res.json({ call: result.rows[0] });
});

router.get('/:id/status', requireAuth, async (req, res) => {
  const result = await db.query(
    'SELECT id, status, room FROM calls WHERE id = $1 AND from_user_id = $2',
    [req.params.id, req.user.userId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Poziv ne postoji.' });
  res.json({ call: result.rows[0] });
});

router.post('/:id/accept', requireAuth, async (req, res) => {
  const result = await db.query(
    `UPDATE calls SET status = 'accepted' WHERE id = $1 AND to_user_id = $2 AND status = 'ringing' RETURNING room`,
    [req.params.id, req.user.userId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Poziv ne postoji ili je istekao.' });
  res.json({ ok: true, room: result.rows[0].room });
});

router.post('/:id/decline', requireAuth, async (req, res) => {
  await db.query(
    `UPDATE calls SET status = 'declined' WHERE id = $1 AND to_user_id = $2 AND status = 'ringing'`,
    [req.params.id, req.user.userId]
  );
  res.json({ ok: true });
});

router.post('/:id/cancel', requireAuth, async (req, res) => {
  await db.query(
    `UPDATE calls SET status = 'missed' WHERE id = $1 AND from_user_id = $2 AND status = 'ringing'`,
    [req.params.id, req.user.userId]
  );
  res.json({ ok: true });
});

module.exports = router;