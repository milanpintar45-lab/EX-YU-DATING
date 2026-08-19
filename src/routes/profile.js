const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { getRegion } = require('../utils/geo');

const router = express.Router();

const EDITABLE_FIELDS = [
  'display_name', 'profile_gender', 'partner_age', 'seeking',
  'height_range', 'weight_range', 'hair_color', 'eye_color',
  'orientation', 'relationship_status', 'bio', 'personal_message', 'block_pokes',
];

function computeAge(birthDate) {
  const today = new Date();
  const bd = new Date(birthDate);
  let age = today.getUTCFullYear() - bd.getUTCFullYear();
  const hadBirthday = today.getUTCMonth() > bd.getUTCMonth() ||
    (today.getUTCMonth() === bd.getUTCMonth() && today.getUTCDate() >= bd.getUTCDate());
  if (!hadBirthday) age -= 1;
  return age;
}

// ============================================
// GET /api/profile/me
// Vraća SAMO slike/video s izvorom "profile" (privatna galerija na profilu)
// ============================================
router.get('/me', requireAuth, async (req, res) => {
  const result = await db.query('SELECT * FROM users WHERE id = $1', [req.user.userId]);
  const u = result.rows[0];
  if (!u) return res.status(404).json({ error: 'Korisnik ne postoji.' });

  const photos = await db.query(
    `SELECT id, privacy, data_url, owner_reaction FROM photos WHERE user_id = $1 AND source = 'profile' ORDER BY id`,
    [u.id]
  );
  const videos = await db.query(
    `SELECT id, privacy, data_url, owner_reaction FROM videos WHERE user_id = $1 AND source = 'profile' ORDER BY id`,
    [u.id]
  );

  res.json({
    nick: u.nick, email: u.email, city: u.city, country: u.country,
    region: getRegion(u.country, u.city),
    gender: u.gender, seekGender: u.seek_gender,
    age: computeAge(u.birth_date), // stvarna dob se UVIJEK računa iz birth_date, ne iz samoprijave
    displayName: u.display_name, profileGender: u.profile_gender, partnerAge: u.partner_age,
    seeking: u.seeking, heightRange: u.height_range, weightRange: u.weight_range,
    hairColor: u.hair_color, eyeColor: u.eye_color, orientation: u.orientation,
    relationshipStatus: u.relationship_status, bio: u.bio, personalMessage: u.personal_message,
    avatarUrl: u.avatar_url, blockPokes: u.block_pokes, contactRestriction: u.contact_restriction,
    photos: photos.rows, videos: videos.rows,
  });
});

// ============================================
// PUT /api/profile/me
// ============================================
router.put('/me', requireAuth, async (req, res) => {
  const updates = {};
  for (const field of EDITABLE_FIELDS) {
    const camelKey = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    if (req.body[camelKey] !== undefined) updates[field] = req.body[camelKey];
  }

  if (updates.bio && String(updates.bio).length > 2000) {
    return res.status(400).json({ error: 'Kratki opis je predugačak.' });
  }
  if (updates.personal_message && String(updates.personal_message).length > 2000) {
    return res.status(400).json({ error: 'Osobna poruka je predugačka.' });
  }
  // NAPOMENA: "godine" (dob) namjerno NIJE editabilno polje - dob se uvijek računa
  // iz birth_date postavljenog kod registracije, da se ne zaobiđe 18+ provjera.

  const keys = Object.keys(updates);
  if (keys.length === 0) return res.json({ ok: true });

  const setClauses = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  const values = keys.map((k) => updates[k]);
  await db.query(
    `UPDATE users SET ${setClauses}, updated_at = now() WHERE id = $1`,
    [req.user.userId, ...values]
  );
  res.json({ ok: true });
});

// ============================================
// POST /api/profile/avatar  { avatarUrl }
// ============================================
router.post('/avatar', requireAuth, async (req, res) => {
  const avatarUrl = req.body.avatarUrl;
  if (!avatarUrl || typeof avatarUrl !== 'string') {
    return res.status(400).json({ error: 'Nedostaje slika.' });
  }
  if (avatarUrl.length > 3 * 1024 * 1024) {
    return res.status(400).json({ error: 'Slika je prevelika (max ~2MB).' });
  }
  await db.query('UPDATE users SET avatar_url = $1, updated_at = now() WHERE id = $2', [avatarUrl, req.user.userId]);
  res.json({ ok: true });
});

// ============================================
// PROFIL GALERIJA / VIDEO (privatno - vidi se samo unutar profila)
// source = 'profile'
// ============================================
router.post('/photos', requireAuth, async (req, res) => {
  const count = await db.query(`SELECT count(*) FROM photos WHERE user_id = $1 AND source = 'profile'`, [req.user.userId]);
  if (Number(count.rows[0].count) >= 8) return res.status(400).json({ error: 'Maksimalno 8 fotografija!' });
  const dataUrl = req.body.dataUrl || null;
  if (dataUrl && dataUrl.length > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'Slika je prevelika (max ~4MB).' });
  }
  const insert = await db.query(
    `INSERT INTO photos (user_id, data_url, source) VALUES ($1, $2, 'profile') RETURNING id, privacy, data_url`,
    [req.user.userId, dataUrl]
  );
  res.json({ photo: insert.rows[0] });
});
router.delete('/photos/:id', requireAuth, async (req, res) => {
  const result = await db.query('DELETE FROM photos WHERE id = $1 AND user_id = $2 RETURNING id', [req.params.id, req.user.userId]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Nije pronađeno.' });
  res.json({ ok: true });
});
router.patch('/photos/:id', requireAuth, async (req, res) => {
  const cycle = ['javno', 'matchevi', 'privatno'];
  const result = await db.query('SELECT privacy FROM photos WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Nije pronađeno.' });
  const next = cycle[(cycle.indexOf(result.rows[0].privacy) + 1) % cycle.length];
  await db.query('UPDATE photos SET privacy = $1 WHERE id = $2', [next, req.params.id]);
  res.json({ privacy: next });
});

// ============================================
// ŠIFRA (kod) ZA SLIKE I VIDEO - vlasnik zaključava, dijeli kod s kim želi
// ============================================
router.post('/photos/:id/lock', requireAuth, async (req, res) => {
  const code = String(req.body.code || '').trim();
  if (!code) return res.status(400).json({ error: 'Šifra ne smije biti prazna.' });
  const result = await db.query(
    `UPDATE photos SET privacy = 'kod', access_code = $1 WHERE id = $2 AND user_id = $3 RETURNING id`,
    [code, req.params.id, req.user.userId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Nije pronađeno.' });
  res.json({ ok: true, privacy: 'kod' });
});
router.post('/photos/:id/unlock', requireAuth, async (req, res) => {
  const result = await db.query(
    `UPDATE photos SET privacy = 'javno', access_code = NULL WHERE id = $1 AND user_id = $2 RETURNING id`,
    [req.params.id, req.user.userId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Nije pronađeno.' });
  res.json({ ok: true, privacy: 'javno' });
});
router.post('/photos/:id/check-code', requireAuth, async (req, res) => {
  const code = String(req.body.code || '').trim();
  const result = await db.query('SELECT data_url, access_code FROM photos WHERE id = $1', [req.params.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Nije pronađeno.' });
  if (!result.rows[0].access_code || result.rows[0].access_code !== code) {
    return res.status(403).json({ error: 'Pogrešna šifra.' });
  }
  res.json({ ok: true, dataUrl: result.rows[0].data_url });
});

router.post('/videos', requireAuth, async (req, res) => {
  const count = await db.query(`SELECT count(*) FROM videos WHERE user_id = $1 AND source = 'profile'`, [req.user.userId]);
  if (Number(count.rows[0].count) >= 5) return res.status(400).json({ error: 'Maksimalno 5 video zapisa!' });
  const dataUrl = req.body.dataUrl || null;
  if (dataUrl && dataUrl.length > 15 * 1024 * 1024) {
    return res.status(400).json({ error: 'Video je prevelik (max ~11MB) - za veće datoteke treba pravi file storage.' });
  }
  const insert = await db.query(
    `INSERT INTO videos (user_id, data_url, source) VALUES ($1, $2, 'profile') RETURNING id, privacy, data_url`,
    [req.user.userId, dataUrl]
  );
  res.json({ video: insert.rows[0] });
});
router.delete('/videos/:id', requireAuth, async (req, res) => {
  const result = await db.query('DELETE FROM videos WHERE id = $1 AND user_id = $2 RETURNING id', [req.params.id, req.user.userId]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Nije pronađeno.' });
  res.json({ ok: true });
});
router.patch('/videos/:id', requireAuth, async (req, res) => {
  const cycle = ['javno', 'matchevi', 'privatno'];
  const result = await db.query('SELECT privacy FROM videos WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Nije pronađeno.' });
  const next = cycle[(cycle.indexOf(result.rows[0].privacy) + 1) % cycle.length];
  await db.query('UPDATE videos SET privacy = $1 WHERE id = $2', [next, req.params.id]);
  res.json({ privacy: next });
});
router.post('/videos/:id/lock', requireAuth, async (req, res) => {
  const code = String(req.body.code || '').trim();
  if (!code) return res.status(400).json({ error: 'Šifra ne smije biti prazna.' });
  const result = await db.query(
    `UPDATE videos SET privacy = 'kod', access_code = $1 WHERE id = $2 AND user_id = $3 RETURNING id`,
    [code, req.params.id, req.user.userId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Nije pronađeno.' });
  res.json({ ok: true, privacy: 'kod' });
});
router.post('/videos/:id/unlock', requireAuth, async (req, res) => {
  const result = await db.query(
    `UPDATE videos SET privacy = 'javno', access_code = NULL WHERE id = $1 AND user_id = $2 RETURNING id`,
    [req.params.id, req.user.userId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Nije pronađeno.' });
  res.json({ ok: true, privacy: 'javno' });
});
router.post('/videos/:id/check-code', requireAuth, async (req, res) => {
  const code = String(req.body.code || '').trim();
  const result = await db.query('SELECT data_url, access_code FROM videos WHERE id = $1', [req.params.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Nije pronađeno.' });
  if (!result.rows[0].access_code || result.rows[0].access_code !== code) {
    return res.status(403).json({ error: 'Pogrešna šifra.' });
  }
  res.json({ ok: true, dataUrl: result.rows[0].data_url });
});

// ============================================
// JAVNA GALERIJA (galerija.html) - vidljivo svima na sajtu, ODVOJENO od profila
// source = 'gallery'
// ============================================
router.get('/gallery/me', requireAuth, async (req, res) => {
  const photos = await db.query(
    `SELECT id, privacy, data_url, owner_reaction FROM photos WHERE user_id = $1 AND source = 'gallery' ORDER BY id`,
    [req.user.userId]
  );
  const videos = await db.query(
    `SELECT id, privacy, data_url, owner_reaction FROM videos WHERE user_id = $1 AND source = 'gallery' ORDER BY id`,
    [req.user.userId]
  );
  res.json({ photos: photos.rows, videos: videos.rows });
});
router.post('/gallery/photos', requireAuth, async (req, res) => {
  const count = await db.query(`SELECT count(*) FROM photos WHERE user_id = $1 AND source = 'gallery'`, [req.user.userId]);
  if (Number(count.rows[0].count) >= 8) return res.status(400).json({ error: 'Maksimalno 8 fotografija!' });
  const dataUrl = req.body.dataUrl || null;
  if (dataUrl && dataUrl.length > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'Slika je prevelika (max ~4MB).' });
  }
  const insert = await db.query(
    `INSERT INTO photos (user_id, data_url, source) VALUES ($1, $2, 'gallery') RETURNING id, privacy, data_url`,
    [req.user.userId, dataUrl]
  );
  res.json({ photo: insert.rows[0] });
});
router.post('/gallery/videos', requireAuth, async (req, res) => {
  const count = await db.query(`SELECT count(*) FROM videos WHERE user_id = $1 AND source = 'gallery'`, [req.user.userId]);
  if (Number(count.rows[0].count) >= 5) return res.status(400).json({ error: 'Maksimalno 5 video zapisa!' });
  const dataUrl = req.body.dataUrl || null;
  if (dataUrl && dataUrl.length > 15 * 1024 * 1024) {
    return res.status(400).json({ error: 'Video je prevelik (max ~11MB) - za veće datoteke treba pravi file storage.' });
  }
  const insert = await db.query(
    `INSERT INTO videos (user_id, data_url, source) VALUES ($1, $2, 'gallery') RETURNING id, privacy, data_url`,
    [req.user.userId, dataUrl]
  );
  res.json({ video: insert.rows[0] });
});

// ============================================
// PATCH /api/profile/photos/:id/reaction  { reaction: 'like' | 'pass' | null }
// Vlasnikova osobna oznaka (koristi se ISKLJUČIVO u galerija.html, ne prikazuje se na profilu)
// ============================================
router.patch('/photos/:id/reaction', requireAuth, async (req, res) => {
  const reaction = ['like', 'pass'].includes(req.body.reaction) ? req.body.reaction : null;
  const result = await db.query(
    'UPDATE photos SET owner_reaction = $1 WHERE id = $2 AND user_id = $3 RETURNING id, owner_reaction',
    [reaction, req.params.id, req.user.userId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Nije pronađeno.' });
  res.json({ ok: true, ownerReaction: result.rows[0].owner_reaction });
});
router.patch('/videos/:id/reaction', requireAuth, async (req, res) => {
  const reaction = ['like', 'pass'].includes(req.body.reaction) ? req.body.reaction : null;
  const result = await db.query(
    'UPDATE videos SET owner_reaction = $1 WHERE id = $2 AND user_id = $3 RETURNING id, owner_reaction',
    [reaction, req.params.id, req.user.userId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Nije pronađeno.' });
  res.json({ ok: true, ownerReaction: result.rows[0].owner_reaction });
});

// ============================================
// GET /api/profile/:nick  - javni pregled (poštuje privatnost galerije/videa i blokove)
// Prikazuje SAMO "profile" izvor (privatna galerija profila), ne javnu galeriju
// ============================================
router.get('/:nick', requireAuth, async (req, res) => {
  const result = await db.query('SELECT * FROM users WHERE nick = $1', [req.params.nick]);
  const u = result.rows[0];
  if (!u) return res.status(404).json({ error: 'Korisnik ne postoji.' });

  const blocked = await db.query(
    `SELECT 1 FROM blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)`,
    [req.user.userId, u.id]
  );
  const isBlocked = blocked.rows.length > 0;

  const matched = await db.query(
    `SELECT 1 FROM matches WHERE (user_a_id = $1 AND user_b_id = $2) OR (user_a_id = $2 AND user_b_id = $1)`,
    [req.user.userId, u.id]
  );
  const isMatch = matched.rows.length > 0;

  if (u.profile_visibility === 'match' && !isMatch && u.id !== req.user.userId) {
    return res.json({
      nick: u.nick, restricted: true,
      message: 'Ovaj korisnik je ograničio vidljivost profila samo na matcheve.',
    });
  }

  function visible(privacy) {
    if (privacy === 'javno') return true;
    if (privacy === 'matchevi') return isMatch;
    return false; // 'privatno' i 'kod' nikad nisu automatski vidljivi
  }

  const photos = await db.query(
    `SELECT id, privacy, data_url FROM photos WHERE user_id = $1 AND source = 'profile' ORDER BY id`,
    [u.id]
  );
  const videos = await db.query(
    `SELECT id, privacy, data_url FROM videos WHERE user_id = $1 AND source = 'profile' ORDER BY id`,
    [u.id]
  );

  const canContact = !isBlocked && (u.contact_restriction !== 'match' || isMatch);

  res.json({
    nick: u.nick, city: u.city, country: u.country, region: getRegion(u.country, u.city),
    gender: u.gender, age: computeAge(u.birth_date),
    displayName: u.display_name, profileGender: u.profile_gender, partnerAge: u.partner_age,
    seeking: u.seeking, heightRange: u.height_range, weightRange: u.weight_range,
    hairColor: u.hair_color, eyeColor: u.eye_color, orientation: u.orientation,
    relationshipStatus: u.relationship_status, bio: u.bio, personalMessage: u.personal_message,
    avatarUrl: u.avatar_url,
    isBlocked, isMatch, canContact,
    isAdmin: u.is_admin,
    photos: photos.rows.map((p) => ({ ...p, visible: visible(p.privacy), data_url: visible(p.privacy) ? p.data_url : null })),
    videos: videos.rows.map((v) => ({ ...v, visible: visible(v.privacy), data_url: visible(v.privacy) ? v.data_url : null })),
  });
});

module.exports = router;
