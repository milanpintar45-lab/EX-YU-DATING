const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { actionLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// ============================================
// POST /api/moderation/report  { toNick, reason }
// ============================================
router.post('/report', requireAuth, actionLimiter, async (req, res) => {
  const toNick = String(req.body.toNick || '').trim();
  const reason = String(req.body.reason || '').trim();
  if (!toNick || !reason) {
    return res.status(400).json({ error: 'Nedostaje korisnik ili razlog prijave.' });
  }

  const toUser = await db.query('SELECT id FROM users WHERE nick = $1', [toNick]);
  if (toUser.rows.length === 0) return res.status(404).json({ error: 'Korisnik ne postoji.' });
  if (toUser.rows[0].id === req.user.userId) {
    return res.status(400).json({ error: 'Ne možete prijaviti sami sebe.' });
  }

  const me = await db.query('SELECT nick FROM users WHERE id = $1', [req.user.userId]);

  await db.query(
    'INSERT INTO reports (from_user_id, to_user_id, from_nick_snapshot, to_nick_snapshot, reason) VALUES ($1, $2, $3, $4, $5)',
    [req.user.userId, toUser.rows[0].id, me.rows[0].nick, toNick, reason]
  );

  // Obavijesti sve admine
  const admins = await db.query('SELECT id FROM users WHERE is_admin = true');
  const text = `${me.rows[0].nick} je prijavio/la korisnika "${toNick}" — ${reason}`;
  await Promise.all(admins.rows.map((a) =>
    db.query(
      'INSERT INTO notifications (user_id, type, text, from_nick) VALUES ($1, $2, $3, $4)',
      [a.id, 'report', text, me.rows[0].nick]
    )
  ));

  res.json({ ok: true });
});

// ============================================
// POST /api/moderation/block  { toNick }
// ============================================
router.post('/block', requireAuth, actionLimiter, async (req, res) => {
  const toNick = String(req.body.toNick || '').trim();
  const toUser = await db.query('SELECT id FROM users WHERE nick = $1', [toNick]);
  if (toUser.rows.length === 0) return res.status(404).json({ error: 'Korisnik ne postoji.' });
  if (toUser.rows[0].id === req.user.userId) {
    return res.status(400).json({ error: 'Ne možete blokirati sami sebe.' });
  }

  await db.query(
    'INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [req.user.userId, toUser.rows[0].id]
  );
  res.json({ ok: true });
});

// ============================================
// GET /api/moderation/blocked-nicks
// Lista nickova koje sam blokirao (koristi frontend za sakrivanje kartica lokalno ako treba)
// ============================================
router.get('/blocked-nicks', requireAuth, async (req, res) => {
  const result = await db.query(
    `SELECT u.nick FROM blocks b JOIN users u ON u.id = b.blocked_id WHERE b.blocker_id = $1`,
    [req.user.userId]
  );
  res.json({ nicks: result.rows.map((r) => r.nick) });
});

// ============================================
// GET /api/moderation/notifications
// ============================================
router.get('/notifications', requireAuth, async (req, res) => {
  const result = await db.query(
    'SELECT id, type, text, from_nick, created_at, read_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
    [req.user.userId]
  );
  res.json({ notifications: result.rows });
});

// ============================================
// POST /api/moderation/notifications/mark-read
// ============================================
router.post('/notifications/mark-read', requireAuth, async (req, res) => {
  await db.query('UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL', [req.user.userId]);
  res.json({ ok: true });
});

// ============================================
// POST /api/moderation/poke  { toNick }
// ============================================
router.post('/poke', requireAuth, actionLimiter, async (req, res) => {
  const toNick = String(req.body.toNick || '').trim();
  const toUser = await db.query('SELECT id FROM users WHERE nick = $1', [toNick]);
  if (toUser.rows.length === 0) return res.status(404).json({ error: 'Korisnik ne postoji.' });
  if (toUser.rows[0].id === req.user.userId) {
    return res.status(400).json({ error: 'Ne možete bockati sami sebe.' });
  }

  const blocked = await db.query(
    'SELECT 1 FROM blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)',
    [req.user.userId, toUser.rows[0].id]
  );
  if (blocked.rows.length > 0) {
    return res.status(400).json({ error: 'Ne možete bockati blokiranog korisnika.' });
  }

  const targetBlocksPokes = await db.query('SELECT block_pokes FROM users WHERE id = $1', [toUser.rows[0].id]);
  if (targetBlocksPokes.rows[0].block_pokes) {
    return res.status(400).json({ error: 'Ovaj korisnik je isključio primanje bockanja.' });
  }

  await db.query('INSERT INTO pokes (from_user_id, to_user_id) VALUES ($1, $2)', [req.user.userId, toUser.rows[0].id]);

  const me = await db.query('SELECT nick FROM users WHERE id = $1', [req.user.userId]);
  await db.query(
    'INSERT INTO notifications (user_id, type, text, from_nick) VALUES ($1, $2, $3, $4)',
    [toUser.rows[0].id, 'poke', `${me.rows[0].nick} vas je bocnuo/la 👉`, me.rows[0].nick]
  );

  res.json({ ok: true });
});

// ============================================
// GET /api/moderation/pokes  - poslana i primljena bockanja
// ============================================
router.get('/pokes', requireAuth, async (req, res) => {
  const received = await db.query(
    `SELECT p.created_at, u.nick AS from_nick FROM pokes p JOIN users u ON u.id = p.from_user_id
     WHERE p.to_user_id = $1 ORDER BY p.created_at DESC`,
    [req.user.userId]
  );
  const sent = await db.query(
    `SELECT p.created_at, u.nick AS to_nick FROM pokes p JOIN users u ON u.id = p.to_user_id
     WHERE p.from_user_id = $1 ORDER BY p.created_at DESC`,
    [req.user.userId]
  );
  res.json({ received: received.rows, sent: sent.rows });
});

// ============================================
// GET /api/moderation/blocked  - detaljna lista blokiranih (za "otključaj" UI)
// ============================================
router.get('/blocked', requireAuth, async (req, res) => {
  const result = await db.query(
    `SELECT u.nick FROM blocks b JOIN users u ON u.id = b.blocked_id WHERE b.blocker_id = $1 ORDER BY b.created_at DESC`,
    [req.user.userId]
  );
  res.json({ blocked: result.rows.map((r) => r.nick) });
});

// ============================================
// DELETE /api/moderation/block/:nick  - odblokiraj
// ============================================
router.delete('/block/:nick', requireAuth, async (req, res) => {
  const toUser = await db.query('SELECT id FROM users WHERE nick = $1', [req.params.nick]);
  if (toUser.rows.length === 0) return res.status(404).json({ error: 'Korisnik ne postoji.' });
  await db.query('DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2', [req.user.userId, toUser.rows[0].id]);
  res.json({ ok: true });
});

module.exports = router;
