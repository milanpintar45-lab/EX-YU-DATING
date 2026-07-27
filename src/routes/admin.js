const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireAdmin); // SVE rute u ovoj datoteci - samo admin

// ============================================
// GET /api/admin/users - potpuna lista (svi statusi, uklj. suspendirane) za admin tablicu
// ============================================
router.get('/users', async (req, res) => {
  const result = await db.query(
    `SELECT nick, email, phone, gender, country, city, status, suspended, is_admin,
            email_verified, phone_verified, created_at
     FROM users WHERE is_admin = false ORDER BY created_at DESC`
  );
  res.json({ users: result.rows });
});

// ============================================
// POST /api/admin/users/:nick/approve
// ============================================
router.post('/users/:nick/approve', async (req, res) => {
  const result = await db.query(
    `UPDATE users SET status = 'approved', updated_at = now() WHERE nick = $1 AND is_admin = false RETURNING nick`,
    [req.params.nick]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Korisnik ne postoji.' });
  res.json({ ok: true });
});

// ============================================
// POST /api/admin/users/:nick/reject
// ============================================
router.post('/users/:nick/reject', async (req, res) => {
  const result = await db.query(
    `UPDATE users SET status = 'rejected', updated_at = now() WHERE nick = $1 AND is_admin = false RETURNING nick`,
    [req.params.nick]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Korisnik ne postoji.' });
  res.json({ ok: true });
});

// ============================================
// POST /api/admin/users/:nick/suspend
// ============================================
router.post('/users/:nick/suspend', async (req, res) => {
  const result = await db.query(
    `UPDATE users SET suspended = true, updated_at = now() WHERE nick = $1 AND is_admin = false RETURNING id, nick`,
    [req.params.nick]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Korisnik ne postoji.' });

  await db.query(
    `UPDATE reports SET status = 'reviewed', sanction = 'suspended'
     WHERE to_user_id = $1 AND status = 'pending'`,
    [result.rows[0].id]
  );

  res.json({ ok: true });
});

// ============================================
// POST /api/admin/users/:nick/unsuspend
// ============================================
router.post('/users/:nick/unsuspend', async (req, res) => {
  const result = await db.query(
    `UPDATE users SET suspended = false, updated_at = now() WHERE nick = $1 AND is_admin = false RETURNING nick`,
    [req.params.nick]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Korisnik ne postoji.' });
  res.json({ ok: true });
});

// ============================================
// GET /api/admin/reports
// ============================================
router.get('/reports', async (req, res) => {
  const result = await db.query(
    `SELECT r.id, r.reason, r.status, r.sanction, r.created_at,
            COALESCE(f.nick, r.from_nick_snapshot) AS from_nick,
            COALESCE(t.nick, r.to_nick_snapshot) AS to_nick,
            (t.id IS NULL) AS to_user_deleted
     FROM reports r
     LEFT JOIN users f ON f.id = r.from_user_id
     LEFT JOIN users t ON t.id = r.to_user_id
     ORDER BY r.created_at DESC LIMIT 200`
  );
  res.json({ reports: result.rows });
});

// ============================================
// POST /api/admin/reports/:id/resolve
// ============================================
router.post('/reports/:id/resolve', async (req, res) => {
  await db.query(`UPDATE reports SET status = 'reviewed' WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
});

// ============================================
// DELETE /api/admin/reports/:id  (odbaci prijavu)
// ============================================
router.delete('/reports/:id', async (req, res) => {
  await db.query('DELETE FROM reports WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ============================================
// POST /api/admin/broadcast  { body }
// Šalje poruku svim ne-admin korisnicima (kroz postojeći messages sustav)
// ============================================
router.post('/broadcast', async (req, res) => {
  const body = String(req.body.body || '').trim();
  if (!body) return res.status(400).json({ error: 'Prazna poruka.' });
  if (body.length > 2000) return res.status(400).json({ error: 'Poruka je predugačka.' });

  const users = await db.query('SELECT id FROM users WHERE is_admin = false');
  await Promise.all(users.rows.map((u) =>
    db.query('INSERT INTO messages (from_user_id, to_user_id, body) VALUES ($1, $2, $3)', [req.user.userId, u.id, body])
  ));

  res.json({ ok: true, sent: users.rows.length });
});

// ============================================
// GET /api/admin/media - sve fotografije/videi svih korisnika (moderacija)
// ============================================
router.get('/media', async (req, res) => {
  const photos = await db.query(
    `SELECT p.id, p.privacy, p.data_url, p.created_at, u.nick FROM photos p JOIN users u ON u.id = p.user_id ORDER BY p.created_at DESC`
  );
  const videos = await db.query(
    `SELECT v.id, v.privacy, v.data_url, v.created_at, u.nick FROM videos v JOIN users u ON u.id = v.user_id ORDER BY v.created_at DESC`
  );
  res.json({ photos: photos.rows, videos: videos.rows });
});

// ============================================
// DELETE /api/admin/media/photo/:id  i  /video/:id
// ============================================
router.delete('/media/photo/:id', async (req, res) => {
  await db.query('DELETE FROM photos WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});
router.delete('/media/video/:id', async (req, res) => {
  await db.query('DELETE FROM videos WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ============================================
// GET /api/admin/messages - SVE poruke u sustavu (uklj. privatne razgovore) - isključivo za moderaciju
// ============================================
router.get('/messages', async (req, res) => {
  const result = await db.query(
    `SELECT m.id, m.body, m.created_at, m.read_at, f.nick AS from_nick, t.nick AS to_nick, t.country
     FROM messages m
     JOIN users f ON f.id = m.from_user_id
     JOIN users t ON t.id = m.to_user_id
     ORDER BY m.created_at DESC LIMIT 300`
  );
  res.json({ messages: result.rows });
});

// ============================================
// DELETE /api/admin/messages/:id
// ============================================
router.delete('/messages/:id', async (req, res) => {
  await db.query('DELETE FROM messages WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ============================================
// DELETE /api/admin/messages - obriši SVE poruke (oprezno!)
// ============================================
router.delete('/messages', async (req, res) => {
  await db.query('DELETE FROM messages');
  res.json({ ok: true });
});

module.exports = router;
