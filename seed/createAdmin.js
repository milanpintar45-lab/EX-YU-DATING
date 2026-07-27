// Pokreni JEDNOM nakon migracije: npm run seed:admin
// Admin lozinka se čita iz .env (ADMIN_PASSWORD) - NIKAD se ne piše u kod ili frontend.
require('dotenv').config();
const db = require('../src/db');
const { hashPassword } = require('../src/utils/crypto');

async function createAdmin() {
  const { ADMIN_NICK, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

  if (!ADMIN_NICK || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('❌ Postavi ADMIN_NICK, ADMIN_EMAIL i ADMIN_PASSWORD u .env prije pokretanja.');
    process.exit(1);
  }
  if (ADMIN_PASSWORD.length < 12) {
    console.error('❌ ADMIN_PASSWORD je prekratka - koristi barem 12 znakova za admin račun.');
    process.exit(1);
  }

  const existing = await db.query('SELECT id FROM users WHERE nick = $1', [ADMIN_NICK]);
  if (existing.rows.length > 0) {
    console.log('ℹ️  Admin korisnik već postoji, ništa se ne mijenja.');
    await db.pool.end();
    return;
  }

  const passwordHash = await hashPassword(ADMIN_PASSWORD);
  await db.query(
    `INSERT INTO users
      (nick, email, password_hash, gender, seek_gender, country, city, birth_date,
       email_verified, phone_verified, voice1_confirmed, is_admin, status, consent_accepted_at)
     VALUES ($1,$2,$3,'m','z','hr','zagreb','1990-01-01', true, true, true, true, 'approved', now())`,
    [ADMIN_NICK, ADMIN_EMAIL, passwordHash]
  );

  console.log(`✅ Admin korisnik "${ADMIN_NICK}" je kreiran.`);
  await db.pool.end();
}

createAdmin();
