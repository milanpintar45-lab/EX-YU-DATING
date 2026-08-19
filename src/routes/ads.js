const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { actionLimiter } = require('../middleware/rateLimit');
const { getRegion } = require('../utils/geo');

const router = express.Router();

const ALLOWED_CATEGORIES = [
  'on-trazi-nju', 'on-trazi-njega', 'on-trazi-par',
  'ona-trazi-nju', 'ona-trazi-njega', 'ona-trazi-par',
  'oni-traze-nju', 'oni-traze-njega', 'oni-traze-par',
  'dominacija', 'fetisizam', 'zenidba-udaja',
];
const ALLOWED_GENDERS = ['m', 'z', 'par'];
const ALLOWED_AGE_RANGES = ['18-25', '25-35', '35-45', '45-55', '55+'];
const ALLOWED_COUNTRIES = ['hr', 'ba', 'rs'];

// ============================================
// GET /api/ads?country=&gender=&category=&region=
// Filteri su POVEZANI - država, spol, kategorija i regija zajedno sužavaju rezultate.
// ============================================
router.get('/', requireAuth, async (req, res) => {
  const { gender, category, country } = req.query;
  const conditions = [];
  const params = [];

  if (country && ALLOWED_COUNTRIES.includes(country)) {
    params.push(country);
    conditions.push(`a.country = $${params.length}`);
  }
  if (gender && ALLOWED_GENDERS.includes(gender)) {
    params.push(gender);
    conditions.push(`a.poster_gender = $${params.length}`);
  }
  if (category && ALLOWED_CATEGORIES.includes(category)) {
    params.push(category);
    conditions.push(`a.category = $${params.length}`);
  }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const result = await db.query(
    `SELECT a.id, a.user_id, a.country, a.category, a.title, a.body, a.poster_gender, a.age_range, a.city, a.created_at, u.nick,
            a.image_url, a.video_url, a.media_privacy
     FROM ads a JOIN users u ON u.id = a.user_id
     ${where}
     ORDER BY a.created_at DESC LIMIT 300`,
    params
  );

  // Regija (županija/kanton/okrug) se računa iz grada - isti pristup kao kod /api/users.
  // Filtriranje po regiji radi se ovdje (nakon upita) jer se regija ne sprema u bazu.
  let ads = result.rows.map((a) => ({ ...a, region: getRegion(a.country, a.city) }));
  if (req.query.region) {
    const wanted = String(req.query.region).trim().toLowerCase();
    ads = ads.filter((a) => a.region && a.region.toLowerCase() === wanted);
  }

  // Sakrij sliku/video ako je media_privacy = 'kod' i nije vlastiti oglas -
  // umjesto stvarnog URL-a, klijent dobiva samo "mediaLocked: true" i mora
  // upisati šifru preko posebne rute da bi dobio pravu sliku/video.
  ads = ads.map((a) => {
    const isOwner = a.user_id === req.user.userId;
    const locked = a.media_privacy === 'kod' && !isOwner;
    return {
      id: a.id, country: a.country, category: a.category, title: a.title, body: a.body,
      poster_gender: a.poster_gender, age_range: a.age_range, city: a.city, created_at: a.created_at,
      nick: a.nick, region: a.region,
      imageUrl: locked ? null : a.image_url,
      videoUrl: locked ? null : a.video_url,
      mediaPrivacy: a.media_privacy,
      mediaLocked: locked,
      isOwner,
    };
  });

  res.json({ ads });
});

// ============================================
// GET /api/ads/counts?country=&region= - broj oglasa po kategoriji (poštuje državu/regiju)
// ============================================
router.get('/counts', requireAuth, async (req, res) => {
  const { country } = req.query;
  const conditions = [];
  const params = [];
  if (country && ALLOWED_COUNTRIES.includes(country)) {
    params.push(country);
    conditions.push(`country = $${params.length}`);
  }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const result = await db.query(
    `SELECT id, category, country, city FROM ads ${where}`,
    params
  );
  let rows = result.rows.map((r) => ({ ...r, region: getRegion(r.country, r.city) }));
  if (req.query.region) {
    const wanted = String(req.query.region).trim().toLowerCase();
    rows = rows.filter((r) => r.region && r.region.toLowerCase() === wanted);
  }

  const counts = {};
  rows.forEach((r) => { counts[r.category] = (counts[r.category] || 0) + 1; });
  res.json({ counts });
});

// ============================================
// POST /api/ads
// Država oglasa se automatski uzima iz profila oglašivača (ne unosi se ručno) -
// tako oglas uvijek pripada stvarnoj, verificiranoj državi korisnika.
// Sada može uključivati i sliku/video (opcionalno).
// ============================================
router.post('/', requireAuth, actionLimiter, async (req, res) => {
  const { category, title, body, posterGender, ageRange, city, imageUrl, videoUrl } = req.body;

  if (!ALLOWED_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Nepoznata kategorija.' });
  }
  if (!ALLOWED_GENDERS.includes(posterGender)) {
    return res.status(400).json({ error: 'Nepoznat spol/oblik.' });
  }
  if (ageRange && !ALLOWED_AGE_RANGES.includes(ageRange)) {
    return res.status(400).json({ error: 'Nepoznat raspon godina.' });
  }
  const cleanTitle = String(title || '').trim();
  const cleanBody = String(body || '').trim();
  if (!cleanTitle || !cleanBody) {
    return res.status(400).json({ error: 'Naslov i tekst oglasa su obavezni.' });
  }
  if (cleanTitle.length > 200) return res.status(400).json({ error: 'Naslov je predugačak.' });
  if (cleanBody.length > 3000) return res.status(400).json({ error: 'Tekst oglasa je predugačak.' });
  if (imageUrl && imageUrl.length > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'Slika je prevelika (max ~4MB).' });
  }
  if (videoUrl && videoUrl.length > 15 * 1024 * 1024) {
    return res.status(400).json({ error: 'Video je prevelik (max ~11MB).' });
  }

  const me = await db.query('SELECT country, city FROM users WHERE id = $1', [req.user.userId]);
  const myCountry = me.rows[0].country;
  const cleanCity = String(city || '').trim() || me.rows[0].city;

  const insert = await db.query(
    `INSERT INTO ads (user_id, country, category, title, body, poster_gender, age_range, city, image_url, video_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [req.user.userId, myCountry, category, cleanTitle, cleanBody, posterGender, ageRange || null, cleanCity || null, imageUrl || null, videoUrl || null]
  );
  res.json({ ok: true, id: insert.rows[0].id });
});

// ============================================
// ŠIFRA (kod) ZA SLIKU/VIDEO UZ OGLAS - vlasnik zaključava, dijeli kod s kim želi
// ============================================
router.post('/:id/lock-media', requireAuth, async (req, res) => {
  const code = String(req.body.code || '').trim();
  if (!code) return res.status(400).json({ error: 'Šifra ne smije biti prazna.' });
  const result = await db.query(
    `UPDATE ads SET media_privacy = 'kod', access_code = $1 WHERE id = $2 AND user_id = $3 RETURNING id`,
    [code, req.params.id, req.user.userId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Oglas ne postoji ili nije vaš.' });
  res.json({ ok: true, mediaPrivacy: 'kod' });
});
router.post('/:id/unlock-media', requireAuth, async (req, res) => {
  const result = await db.query(
    `UPDATE ads SET media_privacy = 'javno', access_code = NULL WHERE id = $1 AND user_id = $2 RETURNING id`,
    [req.params.id, req.user.userId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Oglas ne postoji ili nije vaš.' });
  res.json({ ok: true, mediaPrivacy: 'javno' });
});
router.post('/:id/check-media-code', requireAuth, async (req, res) => {
  const code = String(req.body.code || '').trim();
  const result = await db.query('SELECT image_url, video_url, access_code FROM ads WHERE id = $1', [req.params.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Oglas ne postoji.' });
  if (!result.rows[0].access_code || result.rows[0].access_code !== code) {
    return res.status(403).json({ error: 'Pogrešna šifra.' });
  }
  res.json({ ok: true, imageUrl: result.rows[0].image_url, videoUrl: result.rows[0].video_url });
});

// ============================================
// DELETE /api/ads/:id - vlastiti oglas ili admin
// ============================================
router.delete('/:id', requireAuth, async (req, res) => {
  const isAdmin = !!req.user.isAdmin;
  const result = await db.query(
    isAdmin
      ? 'DELETE FROM ads WHERE id = $1 RETURNING id'
      : 'DELETE FROM ads WHERE id = $1 AND user_id = $2 RETURNING id',
    isAdmin ? [req.params.id] : [req.params.id, req.user.userId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Oglas ne postoji ili nije vaš.' });
  res.json({ ok: true });
});

module.exports = router;
