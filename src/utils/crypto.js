const bcrypt = require('bcrypt');
const crypto = require('crypto');

const SALT_ROUNDS = 12;

async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

async function comparePassword(plainPassword, hash) {
  return bcrypt.compare(plainPassword, hash);
}

// Verifikacijske kodove također hashiramo prije spremanja u bazu -
// ako baza ikad procuri, kodovi (koji su kratkotrajni ali osjetljivi) nisu čitljivi.
async function hashCode(code) {
  return bcrypt.hash(code, 10);
}

async function compareCode(code, hash) {
  return bcrypt.compare(code, hash);
}

function generateSixDigitCode() {
  // crypto.randomInt je kriptografski siguran, za razliku od Math.random()
  return crypto.randomInt(100000, 1000000).toString();
}

module.exports = {
  hashPassword,
  comparePassword,
  hashCode,
  compareCode,
  generateSixDigitCode,
};
