const rateLimit = require('express-rate-limit');

// Sprječava spam slanja email/SMS kodova s istog IP-a
const codeSendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 min
  max: 5,
  message: { error: 'Previše zahtjeva. Pokušajte ponovno za nekoliko minuta.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Sprječava brute-force na login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Previše pokušaja prijave. Pokušajte ponovno za 15 minuta.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Sprječava brute-force na forgot-password
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Previše pokušaja oporavka lozinke. Pokušajte ponovno kasnije.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Opći "kišobran" limiter - druga linija obrane za sve API rute (osim ako ruta
// ima svoj stroži limiter ispod). Sprječava grubi DoS/scraping s jednog IP-a.
const globalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Previše zahtjeva s ove adrese. Pokušajte ponovno kasnije.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Sprječava masovnu automatsku registraciju botova
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 sat
  max: 8,
  message: { error: 'Previše registracija s ove adrese. Pokušajte ponovno kasnije.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Sprječava spam poruka/prijava/oglasa/poklona/bockanja/zahtjeva za prijateljstvo
const actionLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 40,
  message: { error: 'Prebrzo šaljete zahtjeve. Usporite malo.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { codeSendLimiter, loginLimiter, forgotPasswordLimiter, globalApiLimiter, registerLimiter, actionLimiter };
