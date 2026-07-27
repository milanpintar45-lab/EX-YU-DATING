const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { getRegion } = require('../utils/geo');

const router = express.Router();
const ALLOWED_COUNTRIES = ['hr', 'ba', 'rs'];

// Korisnik se smatra "online" ako je pingao u zadnjih 5 minuta
const ONLINE_WINDOW_MINUTES = 5;

// Polja koja je SIGURNO vratiti drugim korisnicima (nikad email/telefon/password_hash)
const PUBLIC_FIELDS = `
  nick, nick2, gender, seek_gender, country, city,
  date_part('year', age(birth_date))::int AS age,
  (show_online_status AND last_seen_at > now() - interval '${ONLINE_WINDOW_MINUTES} minutes') AS is_online
`;

// ============================================
// POST /api/users/presence-ping
// Klijent zove periodički (npr. svakih 60s) dok je stranica otvorena
// ============================================
router.post('/presence-ping', requireAuth, async (req, res) => {
  await db.query('UPDATE users SET last_seen_at = now() WHERE id = $1', [req.user.userId]);
  res.json({ ok: true });
});

// ============================================
// GET /api/users?country=hr&county=&onlineOnly=true&search=nick
// Lista odobrenih profila (bez admina, bez trenutnog korisnika) - za chat/na-mreži/svi-korisnici
// ============================================
router.get('/', requireAuth, async (req, res) => {
  const { country, onlineOnly, search, gender, ageMin, ageMax, sort, region } = req.query;
  const conditions = [
    'status = $1', 'is_admin = false', 'id != $2', 'suspended = false', 'paused = false',
    'id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = $2)',
    'id NOT IN (SELECT blocker_id FROM blocks WHERE blocked_id = $2)',
  ];
  const params = ['approved', req.user.userId];

  if (country && ALLOWED_COUNTRIES.includes(country)) {
    params.push(country);
    conditions.push(`country = $${params.length}`);
  }
  if (gender && ['m', 'z', 'p'].includes(gender)) {
    params.push(gender);
    conditions.push(`gender = $${params.length}`);
  }
  if (search) {
    params.push(`%${String(search).trim()}%`);
    conditions.push(`nick ILIKE $${params.length}`);
  }
  if (onlineOnly === 'true') {
    conditions.push(`last_seen_at > now() - interval '${ONLINE_WINDOW_MINUTES} minutes'`);
  }
  if (ageMin && !isNaN(parseInt(ageMin, 10))) {
    params.push(parseInt(ageMin, 10));
    conditions.push(`date_part('year', age(birth_date)) >= $${params.length}`);
  }
  if (ageMax && !isNaN(parseInt(ageMax, 10))) {
    params.push(parseInt(ageMax, 10));
    conditions.push(`date_part('year', age(birth_date)) <= $${params.length}`);
  }

  const orderBy = sort === 'ime' ? 'nick ASC' : 'last_seen_at DESC NULLS LAST';

  const result = await db.query(
    `SELECT ${PUBLIC_FIELDS} FROM users WHERE ${conditions.join(' AND ')} ORDER BY ${orderBy} LIMIT 200`,
    params
  );

  // Regija/županija se izračunava iz grada (mapiranje), ne sprema se posebno u bazu -
  // grad ostaje jedini "izvor istine", regija je samo prikazni derivat.
  let users = result.rows.map((u) => ({ ...u, region: getRegion(u.country, u.city) }));
  if (region) {
    const wanted = String(region).trim().toLowerCase();
    users = users.filter((u) => u.region && u.region.toLowerCase() === wanted);
  }

  res.json({ users });
});

// ============================================
// GET /api/users/stats?country=hr
// Brojevi za status traku (online/žene/muškarci/parovi)
// ============================================
router.get('/stats', requireAuth, async (req, res) => {
  const { country } = req.query;
  const conditions = ['status = $1', 'is_admin = false'];
  const params = ['approved'];

  if (country && ALLOWED_COUNTRIES.includes(country)) {
    params.push(country);
    conditions.push(`country = $${params.length}`);
  }

  const result = await db.query(
    `SELECT
      count(*) FILTER (WHERE last_seen_at > now() - interval '${ONLINE_WINDOW_MINUTES} minutes') AS online,
      count(*) FILTER (WHERE gender = 'z') AS women,
      count(*) FILTER (WHERE gender = 'm') AS men,
      count(*) FILTER (WHERE gender = 'p') AS pairs
     FROM users WHERE ${conditions.join(' AND ')}`,
    params
  );
  const row = result.rows[0];
  res.json({
    online: Number(row.online), women: Number(row.women),
    men: Number(row.men), pairs: Number(row.pairs),
  });
});

// ============================================
// GET /api/users/friends-count
// Stvaran broj prihvaćenih prijateljstava (vidi /api/friends za sustav zahtjeva)
// ============================================
router.get('/friends-count', requireAuth, async (req, res) => {
  const result = await db.query(
    `SELECT count(*) FROM friend_requests WHERE (from_user_id = $1 OR to_user_id = $1) AND status = 'accepted'`,
    [req.user.userId]
  );
  res.json({ count: Number(result.rows[0].count) });
});

// ============================================
// DELETE /api/users/:nick  - SAMO ADMIN, trajno brisanje korisnika
// ============================================
router.delete('/:nick', requireAuth, requireAdmin, async (req, res) => {
  const target = await db.query('SELECT id FROM users WHERE nick = $1 AND is_admin = false', [req.params.nick]);
  if (target.rows.length === 0) {
    return res.status(404).json({ error: 'Korisnik ne postoji ili je admin (admin se ne može obrisati ovim putem).' });
  }
  const targetId = target.rows[0].id;

  // Označi sve prijave protiv ovog korisnika kao "sankcionirano - izbačen" PRIJE brisanja -
  // snapshot nickova u reports tablici ostaje čitljiv i nakon što račun nestane.
  await db.query(
    `UPDATE reports SET status = 'reviewed', sanction = 'kicked' WHERE to_user_id = $1`,
    [targetId]
  );

  await db.query('DELETE FROM users WHERE id = $1', [targetId]);
  res.json({ ok: true });
});

module.exports = router;
