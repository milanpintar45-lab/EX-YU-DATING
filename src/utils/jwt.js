const jwt = require('jsonwebtoken');

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return null;
  }
}

// Kratkotrajni "tiket" koji dokazuje da je email/telefon upravo verificiran,
// bez potrebe za dodatnom tablicom u bazi prije nego korisnik uopće postoji.
function signVerificationTicket(type, target) {
  return jwt.sign({ purpose: 'verification', type, target }, process.env.JWT_SECRET, {
    expiresIn: '30m',
  });
}

function verifyVerificationTicket(token, type, target) {
  const payload = verifyToken(token);
  if (!payload) return false;
  return (
    payload.purpose === 'verification' &&
    payload.type === type &&
    payload.target === target
  );
}

module.exports = { signToken, verifyToken, signVerificationTicket, verifyVerificationTicket };
