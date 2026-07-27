require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('./db');

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  try {
    await db.query(sql);
    console.log('✅ Migracija uspješna - sve tablice su spremne.');
  } catch (err) {
    console.error('❌ Migracija nije uspjela:', err.message);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
}

migrate();
