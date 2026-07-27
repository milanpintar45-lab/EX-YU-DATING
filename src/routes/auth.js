const express = require('express');
const validator = require('validator');
const db = require('../db');
const { hashPassword, comparePassword, hashCode, compareCode, generateSixDigitCode } = require('../utils/crypto');
const { signToken, signVerificationTicket, verifyVerificationTicket } = require('../utils/jwt');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/email');
const { sendVerificationSms } = require('../services/sms');
const { codeSendLimiter, loginLimiter, forgotPasswordLimiter, registerLimiter } = require('../middleware/rateLimit');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const ALLOWED_COUNTRIES = ['hr', 'ba', 'rs'];
const ALLOWED_GENDERS = ['m', 'z', 'p'];
const CODE_TTL_MINUTES = 10;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 dana
  };
}

// ============================================
// POST /api/auth/send-email-code
// ============================================
router.post('/send-email-code', codeSendLimiter, async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!validator.isEmail(email)) {
    return res.status(400).json({ error: 'Neispravna email adresa.' });
  }

  const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'Ova email adresa je već registrirana.' });
  }

  const code = generateSixDigitCode();
  const codeHash = await hashCode(code);
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

  await db.query('DELETE FROM verification_codes WHERE target = $1 AND type = $2', [email, 'email']);
  await db.query(
    'INSERT INTO verification_codes (target, code_hash, type, expires_at) VALUES ($1, $2, $3, $4)',
    [email, codeHash, 'email', expiresAt]
  );

  try {
    await sendVerificationEmail(email, code);
  } catch (err) {
    console.error('Greška slanja emaila:', err.message);
    return res.status(502).json({ error: 'Slanje emaila trenutno nije uspjelo. Pokušajte ponovno.' });
  }

  res.json({ ok: true, message: 'Kod je poslan na email.' });
});

// ============================================
// POST /api/auth/verify-email-code
// ============================================
router.post('/verify-email-code', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const code = String(req.body.code || '').trim();

  const result = await db.query(
    'SELECT * FROM verification_codes WHERE target = $1 AND type = $2 ORDER BY created_at DESC LIMIT 1',
    [email, 'email']
  );
  const row = result.rows[0];

  if (!row || new Date(row.expires_at) < new Date()) {
    return res.status(400).json({ error: 'Kod je istekao. Zatražite novi.' });
  }
  if (row.attempts >= 5) {
    return res.status(429).json({ error: 'Previše pokušaja. Zatražite novi kod.' });
  }

  const matches = await compareCode(code, row.code_hash);
  if (!matches) {
    await db.query('UPDATE verification_codes SET attempts = attempts + 1 WHERE id = $1', [row.id]);
    return res.status(400).json({ error: 'Pogrešan kod.' });
  }

  await db.query('DELETE FROM verification_codes WHERE id = $1', [row.id]);

  // Izdaj kratkotrajni tiket koji frontend šalje uz finalnu registraciju
  const ticket = signVerificationTicket('email', email);
  res.json({ ok: true, ticket });
});

// ============================================
// POST /api/auth/send-phone-code
// ============================================
router.post('/send-phone-code', codeSendLimiter, async (req, res) => {
  const phone = String(req.body.phone || '').trim();
  if (phone.length < 6) {
    return res.status(400).json({ error: 'Neispravan broj mobitela.' });
  }

  const existing = await db.query('SELECT id FROM users WHERE phone = $1', [phone]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'Ovaj broj mobitela je već registriran.' });
  }

  const code = generateSixDigitCode();
  const codeHash = await hashCode(code);
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

  await db.query('DELETE FROM verification_codes WHERE target = $1 AND type = $2', [phone, 'phone']);
  await db.query(
    'INSERT INTO verification_codes (target, code_hash, type, expires_at) VALUES ($1, $2, $3, $4)',
    [phone, codeHash, 'phone', expiresAt]
  );

  try {
    await sendVerificationSms(phone, code);
  } catch (err) {
    console.error('Greška slanja SMS-a:', err.message);
    return res.status(502).json({ error: 'Slanje SMS-a trenutno nije uspjelo. Pokušajte ponovno.' });
  }

  res.json({ ok: true, message: 'Kod je poslan SMS-om.' });
});

// ============================================
// POST /api/auth/verify-phone-code
// ============================================
router.post('/verify-phone-code', async (req, res) => {
  const phone = String(req.body.phone || '').trim();
  const code = String(req.body.code || '').trim();

  const result = await db.query(
    'SELECT * FROM verification_codes WHERE target = $1 AND type = $2 ORDER BY created_at DESC LIMIT 1',
    [phone, 'phone']
  );
  const row = result.rows[0];

  if (!row || new Date(row.expires_at) < new Date()) {
    return res.status(400).json({ error: 'Kod je istekao. Zatražite novi.' });
  }
  if (row.attempts >= 5) {
    return res.status(429).json({ error: 'Previše pokušaja. Zatražite novi kod.' });
  }

  const matches = await compareCode(code, row.code_hash);
  if (!matches) {
    await db.query('UPDATE verification_codes SET attempts = attempts + 1 WHERE id = $1', [row.id]);
    return res.status(400).json({ error: 'Pogrešan kod.' });
  }

  await db.query('DELETE FROM verification_codes WHERE id = $1', [row.id]);

  const ticket = signVerificationTicket('phone', phone);
  res.json({ ok: true, ticket });
});

// ============================================
// POST /api/auth/register
// ============================================
router.post('/register', registerLimiter, async (req, res) => {
  const {
    nick, nick2, email, phone, password,
    gender, seekGender, country, city, birthDate,
    emailTicket, phoneTicket,
    voice1Confirmed, voice2Confirmed,
    consents, // objekt npr. { age: true, explicit: true, content: true, ... }
  } = req.body;

  const REQUIRED_CONSENTS = ['age', 'terms', 'visible', 'explicit', 'content', 'fakeprofiles', 'interactions', 'datause', 'moderation', 'review'];
  const consentObj = consents && typeof consents === 'object' ? consents : {};
  const missingConsents = REQUIRED_CONSENTS.filter((key) => consentObj[key] !== true);

  const cleanNick = String(nick || '').trim();
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanPhone = String(phone || '').trim();

  // --- Validacija osnovnih polja ---
  if (!cleanNick || cleanNick.length < 2) {
    return res.status(400).json({ error: 'Nick mora imati barem 2 znaka.' });
  }
  if (!validator.isEmail(cleanEmail)) {
    return res.status(400).json({ error: 'Neispravna email adresa.' });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Lozinka mora imati barem 8 znakova.' });
  }
  if (!ALLOWED_GENDERS.includes(gender) || !ALLOWED_GENDERS.includes(seekGender)) {
    return res.status(400).json({ error: 'Neispravan odabir spola.' });
  }
  if (!ALLOWED_COUNTRIES.includes(country)) {
    return res.status(400).json({ error: 'Neispravan odabir države.' });
  }
  if (!city) {
    return res.status(400).json({ error: 'Odaberite grad.' });
  }
  if (gender === 'p' && !String(nick2 || '').trim()) {
    return res.status(400).json({ error: 'Za par profil potreban je i drugi nick.' });
  }

  // --- Stvarna provjera dobi (18+) na temelju datuma rođenja, ne samo checkboxa ---
  const parsedBirthDate = new Date(birthDate);
  if (!birthDate || isNaN(parsedBirthDate.getTime())) {
    return res.status(400).json({ error: 'Unesite ispravan datum rođenja.' });
  }
  const today = new Date();
  let age = today.getUTCFullYear() - parsedBirthDate.getUTCFullYear();
  const hadBirthdayThisYear =
    today.getUTCMonth() > parsedBirthDate.getUTCMonth() ||
    (today.getUTCMonth() === parsedBirthDate.getUTCMonth() && today.getUTCDate() >= parsedBirthDate.getUTCDate());
  if (!hadBirthdayThisYear) age -= 1;
  if (age < 18 || age > 120) {
    return res.status(403).json({ error: 'Platforma je namijenjena isključivo osobama starijim od 18 godina.' });
  }

  // --- Obavezne provjere (ovo je bilo samo na frontendu - sada i server provjerava) ---
  if (!verifyVerificationTicket(emailTicket, 'email', cleanEmail)) {
    return res.status(400).json({ error: 'Email nije potvrđen (ili je potvrda istekla). Ponovite potvrdu emaila.' });
  }
  if (!verifyVerificationTicket(phoneTicket, 'phone', cleanPhone)) {
    return res.status(400).json({ error: 'Broj mobitela nije potvrđen (ili je potvrda istekla). Ponovite potvrdu.' });
  }
  if (!voice1Confirmed) {
    return res.status(400).json({ error: 'Glasovna provjera 1 nije završena.' });
  }
  if (gender === 'p' && !voice2Confirmed) {
    return res.status(400).json({ error: 'Glasovna provjera 2 nije završena.' });
  }
  if (missingConsents.length > 0) {
    return res.status(400).json({
      error: 'Morate prihvatiti sve uvjete korištenja i zakonske suglasnosti (uključujući potvrdu punoljetnosti) prije registracije.',
    });
  }

  // --- Provjera da nick/email/phone već ne postoje ---
  const dup = await db.query(
    'SELECT id FROM users WHERE nick = $1 OR email = $2 OR (phone = $3 AND phone IS NOT NULL)',
    [cleanNick, cleanEmail, cleanPhone]
  );
  if (dup.rows.length > 0) {
    return res.status(409).json({ error: 'Nick, email ili broj mobitela već postoje u sustavu.' });
  }

  const passwordHash = await hashPassword(password);

  const insert = await db.query(
    `INSERT INTO users
      (nick, nick2, email, phone, password_hash, gender, seek_gender, country, city, birth_date,
       email_verified, phone_verified, voice1_confirmed, voice2_confirmed,
       status, consent_accepted_at, consent_details, consent_ip)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, true, true, $11, $12, 'pending', now(), $13, $14)
     RETURNING id, nick`,
    [
      cleanNick, gender === 'p' ? String(nick2).trim() : null, cleanEmail, cleanPhone, passwordHash,
      gender, seekGender, country, city, birthDate,
      !!voice1Confirmed, gender === 'p' ? !!voice2Confirmed : false,
      JSON.stringify(consentObj), req.ip,
    ]
  );

  const user = insert.rows[0];
  const token = signToken({ userId: user.id, nick: user.nick, isAdmin: false });
  res.cookie(process.env.COOKIE_NAME || 'exyu_session', token, cookieOptions());

  res.json({ ok: true, nick: user.nick });
});

// ============================================
// POST /api/auth/login
// ============================================
router.post('/login', loginLimiter, async (req, res) => {
  const nick = String(req.body.nick || '').trim();
  const password = String(req.body.password || '');
  const rememberMe = !!req.body.rememberMe;

  if (!nick || !password) {
    return res.status(400).json({ error: 'Upišite nick i lozinku.' });
  }

  // Provjeri je li OVAJ RAČUN (ne samo IP) trenutno blokiran zbog previše pogrešnih pokušaja
  const blockCheck = await db.query(
    'SELECT blocked_until FROM login_blocks WHERE identifier = $1 AND blocked_until > now()',
    [nick.toLowerCase()]
  );
  if (blockCheck.rows.length > 0) {
    const minutesLeft = Math.ceil((new Date(blockCheck.rows[0].blocked_until) - new Date()) / 60000);
    return res.status(429).json({ error: `Previše pogrešnih pokušaja za ovaj račun. Pokušajte ponovno za ${minutesLeft} min.` });
  }

  const result = await db.query('SELECT * FROM users WHERE nick = $1', [nick]);
  const user = result.rows[0];

  async function registerFailedAttempt() {
    const key = nick.toLowerCase();
    const recentFails = await db.query(
      `SELECT count(*) FROM login_fail_log WHERE identifier = $1 AND created_at > now() - interval '15 minutes'`,
      [key]
    ).catch(() => ({ rows: [{ count: 0 }] }));
    await db.query('INSERT INTO login_fail_log (identifier) VALUES ($1)', [key]).catch(() => {});
    const failCount = Number(recentFails.rows[0].count) + 1;
    if (failCount >= 5) {
      await db.query(
        `INSERT INTO login_blocks (identifier, blocked_until) VALUES ($1, now() + interval '15 minutes')
         ON CONFLICT (identifier) DO UPDATE SET blocked_until = now() + interval '15 minutes'`,
        [key]
      );
    }
  }

  if (!user) {
    await registerFailedAttempt();
    return res.status(401).json({ error: 'Pogrešan nick ili lozinka.' });
  }

  const ok = await comparePassword(password, user.password_hash);
  if (!ok) {
    await registerFailedAttempt();
    return res.status(401).json({ error: 'Pogrešan nick ili lozinka.' });
  }
  if (user.suspended) {
    return res.status(403).json({ error: 'Vaš račun je suspendiran. Obratite se administratoru.' });
  }

  await db.query('DELETE FROM login_blocks WHERE identifier = $1', [nick.toLowerCase()]).catch(() => {});

  let welcomeBack = false;
  if (user.paused) {
    await db.query('UPDATE users SET paused = false, updated_at = now() WHERE id = $1', [user.id]);
    welcomeBack = true;
  }

  const token = signToken({ userId: user.id, nick: user.nick, isAdmin: user.is_admin });
  const opts = cookieOptions();
  if (!rememberMe) {
    delete opts.maxAge; // cookie nestaje kad se zatvori preglednik
  }
  res.cookie(process.env.COOKIE_NAME || 'exyu_session', token, opts);

  res.json({ ok: true, nick: user.nick, isAdmin: user.is_admin, welcomeBack });
});

// ============================================
// POST /api/auth/logout
// ============================================
router.post('/logout', (req, res) => {
  res.clearCookie(process.env.COOKIE_NAME || 'exyu_session');
  res.json({ ok: true });
});

// ============================================
// GET /api/auth/me
// ============================================
router.get('/me', (req, res) => {
  if (!req.user) return res.json({ loggedIn: false });
  res.json({ loggedIn: true, nick: req.user.nick, isAdmin: !!req.user.isAdmin });
});

// ============================================
// FORGOT PASSWORD - 3 koraka
// ============================================

// Korak 1: zatraži kod (šalje se na maskirani email/telefon iz baze)
router.post('/forgot-password/request', forgotPasswordLimiter, async (req, res) => {
  const nick = String(req.body.nick || '').trim();
  const method = req.body.method; // 'email' ili 'phone'

  const result = await db.query('SELECT * FROM users WHERE nick = $1', [nick]);
  const user = result.rows[0];

  // Sigurnosno: uvijek vraćamo istu poruku, bez obzira postoji li nick,
  // da se ne otkriva koji nickovi postoje u sustavu.
  const genericResponse = { ok: true, message: 'Ako nick postoji, upute su poslane.' };

  if (!user) return res.json(genericResponse);

  const target = method === 'phone' ? user.phone : user.email;
  if (!target) return res.json(genericResponse);

  const code = generateSixDigitCode();
  const codeHash = await hashCode(code);
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

  await db.query('DELETE FROM password_resets WHERE user_id = $1', [user.id]);
  await db.query(
    'INSERT INTO password_resets (user_id, code_hash, expires_at) VALUES ($1, $2, $3)',
    [user.id, codeHash, expiresAt]
  );

  try {
    if (method === 'phone') {
      await sendVerificationSms(target, code);
    } else {
      await sendPasswordResetEmail(target, code);
    }
  } catch (err) {
    console.error('Greška slanja reset koda:', err.message);
  }

  res.json(genericResponse);
});

// Korak 2: potvrdi kod, dobij reset tiket
router.post('/forgot-password/verify', forgotPasswordLimiter, async (req, res) => {
  const nick = String(req.body.nick || '').trim();
  const code = String(req.body.code || '').trim();

  const userResult = await db.query('SELECT * FROM users WHERE nick = $1', [nick]);
  const user = userResult.rows[0];
  if (!user) return res.status(400).json({ error: 'Neispravan kod.' });

  const result = await db.query(
    'SELECT * FROM password_resets WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
    [user.id]
  );
  const row = result.rows[0];
  if (!row || new Date(row.expires_at) < new Date()) {
    return res.status(400).json({ error: 'Kod je istekao. Zatražite novi.' });
  }
  if (row.attempts >= 3) {
    return res.status(429).json({ error: 'Previše pokušaja. Zatražite novi kod.' });
  }

  const matches = await compareCode(code, row.code_hash);
  if (!matches) {
    await db.query('UPDATE password_resets SET attempts = attempts + 1 WHERE id = $1', [row.id]);
    return res.status(400).json({ error: 'Pogrešan kod.' });
  }

  const ticket = signVerificationTicket('password-reset', nick);
  res.json({ ok: true, ticket });
});

// Korak 3: postavi novu lozinku
router.post('/forgot-password/reset', async (req, res) => {
  const nick = String(req.body.nick || '').trim();
  const newPassword = String(req.body.newPassword || '');
  const ticket = req.body.ticket;

  if (!verifyVerificationTicket(ticket, 'password-reset', nick)) {
    return res.status(400).json({ error: 'Potvrda je istekla. Ponovite postupak oporavka.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Lozinka mora imati barem 8 znakova.' });
  }

  const userResult = await db.query('SELECT * FROM users WHERE nick = $1', [nick]);
  const user = userResult.rows[0];
  if (!user) return res.status(400).json({ error: 'Korisnik ne postoji.' });

  const passwordHash = await hashPassword(newPassword);
  await db.query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [passwordHash, user.id]);
  await db.query('DELETE FROM password_resets WHERE user_id = $1', [user.id]);

  res.json({ ok: true, message: 'Lozinka je uspješno promijenjena.' });
});

// ============================================
// POST /api/auth/change-password  { oldPassword, newPassword }
// ============================================
router.post('/change-password', requireAuth, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Molimo ispunite sva polja.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Nova lozinka mora imati barem 8 znakova.' });
  }

  const result = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.user.userId]);
  const ok = await comparePassword(oldPassword, result.rows[0].password_hash);
  if (!ok) {
    return res.status(401).json({ error: 'Trenutna lozinka nije ispravna.' });
  }

  const newHash = await hashPassword(newPassword);
  await db.query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [newHash, req.user.userId]);
  res.json({ ok: true });
});

// ============================================
// POST /api/auth/pause - korisnik SAM privremeno pauzira račun (bez brisanja podataka)
// ============================================
router.post('/pause', requireAuth, async (req, res) => {
  await db.query('UPDATE users SET paused = true, updated_at = now() WHERE id = $1', [req.user.userId]);
  res.clearCookie(process.env.COOKIE_NAME || 'exyu_session');
  res.json({ ok: true });
});

// ============================================
// DELETE /api/auth/me - korisnik briše vlastiti račun
// ============================================
router.delete('/me', requireAuth, async (req, res) => {
  await db.query('DELETE FROM users WHERE id = $1 AND is_admin = false', [req.user.userId]);
  res.clearCookie(process.env.COOKIE_NAME || 'exyu_session');
  res.json({ ok: true });
});

module.exports = router;
