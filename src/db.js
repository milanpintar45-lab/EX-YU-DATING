const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL nije postavljen u .env datoteci!');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Ako hosting baze (npr. Render, Railway, Supabase) traži SSL, otkomentiraj:
  // ssl: { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('Neočekivana greška na neaktivnom klijentu baze:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
