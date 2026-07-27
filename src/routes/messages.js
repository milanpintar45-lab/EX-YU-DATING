const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { actionLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// ============================================
// POST /api/messages  { toNick, body }
// ============================================
router.post('/', requireAuth, actionLimiter, async (req, res) => {
  const toNick = String(req.body.toNick || '').trim();
  const body = String(req.body.body || '').trim();

  if (!toNick || !body) {
    return res.status(400).json({ error: 'Nedostaje primatelj ili tekst poruke.' });
  }
  if (body.length > 2000) {
    return res.status(400).json({ error: 'Poruka je predugačka (max 2000 znakova).' });
  }

  const toUser = await db.query('SELECT id FROM users WHERE nick = $1', [toNick]);
  if (toUser.rows.length === 0) {
    return res.status(404).json({ error: 'Primatelj ne postoji.' });
  }

  await db.query(
    'INSERT INTO messages (from_user_id, to_user_id, body) VALUES ($1, $2, $3)',
    [req.user.userId, toUser.rows[0].id, body]
  );
  res.json({ ok: true });
});

// ============================================
// GET /api/messages/inbox
// Sve primljene poruke trenutnog korisnika (najnovije prve), + auto mark-as-read
// ============================================
router.get('/inbox', requireAuth, async (req, res) => {
  const result = await db.query(
    `SELECT m.id, m.body, m.created_at, m.read_at, u.nick AS from_nick
     FROM messages m JOIN users u ON u.id = m.from_user_id
     WHERE m.to_user_id = $1
     ORDER BY m.created_at DESC LIMIT 100`,
    [req.user.userId]
  );

  await db.query(
    'UPDATE messages SET read_at = now() WHERE to_user_id = $1 AND read_at IS NULL',
    [req.user.userId]
  );

  res.json({ messages: result.rows });
});

// ============================================
// GET /api/messages/unread-count
// ============================================
router.get('/unread-count', requireAuth, async (req, res) => {
  const result = await db.query(
    'SELECT count(*) FROM messages WHERE to_user_id = $1 AND read_at IS NULL',
    [req.user.userId]
  );
  res.json({ count: Number(result.rows[0].count) });
});

// ============================================
// GET /api/messages/conversations
// Lista sugovornika s kojima postoji razmjena poruka (za sidebar u chat.html)
// ============================================
router.get('/conversations', requireAuth, async (req, res) => {
  const result = await db.query(
    `SELECT
       other.nick AS nick,
       last_msg.body AS last_body,
       last_msg.created_at AS last_time,
       (SELECT count(*) FROM messages
         WHERE to_user_id = $1 AND from_user_id = other.id AND read_at IS NULL) AS unread
     FROM (
       SELECT DISTINCT
         CASE WHEN from_user_id = $1 THEN to_user_id ELSE from_user_id END AS other_id
       FROM messages WHERE from_user_id = $1 OR to_user_id = $1
     ) t
     JOIN users other ON other.id = t.other_id
     JOIN LATERAL (
       SELECT body, created_at FROM messages
       WHERE (from_user_id = $1 AND to_user_id = other.id) OR (from_user_id = other.id AND to_user_id = $1)
       ORDER BY created_at DESC LIMIT 1
     ) last_msg ON true
     ORDER BY last_msg.created_at DESC`,
    [req.user.userId]
  );
  res.json({ conversations: result.rows });
});

// ============================================
// GET /api/messages/thread/:nick
// Puna razmjena poruka s jednim korisnikom (oba smjera), + mark-as-read
// ============================================
router.get('/thread/:nick', requireAuth, async (req, res) => {
  const other = await db.query('SELECT id FROM users WHERE nick = $1', [req.params.nick]);
  if (other.rows.length === 0) return res.status(404).json({ error: 'Korisnik ne postoji.' });
  const otherId = other.rows[0].id;

  const result = await db.query(
    `SELECT id, from_user_id, to_user_id, body, created_at
     FROM messages
     WHERE (from_user_id = $1 AND to_user_id = $2) OR (from_user_id = $2 AND to_user_id = $1)
     ORDER BY created_at ASC LIMIT 500`,
    [req.user.userId, otherId]
  );

  await db.query(
    'UPDATE messages SET read_at = now() WHERE to_user_id = $1 AND from_user_id = $2 AND read_at IS NULL',
    [req.user.userId, otherId]
  );

  const messages = result.rows.map((m) => ({
    id: m.id, body: m.body, created_at: m.created_at, own: m.from_user_id === req.user.userId,
  }));
  res.json({ messages });
});

// ============================================
// DELETE /api/messages/:id
// Briše poruku - samo vlastitu (from_user_id mora biti trenutni korisnik)
// ============================================
router.delete('/:id', requireAuth, async (req, res) => {
  const result = await db.query(
    'DELETE FROM messages WHERE id = $1 AND from_user_id = $2 RETURNING id',
    [req.params.id, req.user.userId]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Poruka ne postoji ili nije vaša.' });
  }
  res.json({ ok: true });
});

module.exports = router;
