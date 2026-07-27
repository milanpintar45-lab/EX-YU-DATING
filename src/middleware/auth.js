const { verifyToken } = require('../utils/jwt');
const db = require('../db');

// Postavlja req.user ako postoji ispravan session cookie I korisnik je i dalje aktivan u bazi
// (nije suspendiran, nije obrisan). Ovo je bitno: bez ove provjere, suspendirani korisnik sa
// starom, već aktivnom sesijom mogao bi nastaviti raditi SVE dok mu JWT prirodno ne istekne
// (do 30 dana) ili dok se sam ne odjavi - suspenzija bi bila samo kozmetička.
async function attachUser(req, res, next) {
  const token = req.cookies[process.env.COOKIE_NAME || 'exyu_session'];
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      try {
        const result = await db.query(
          'SELECT id, nick, is_admin, suspended, paused FROM users WHERE id = $1',
          [payload.userId]
        );
        const user = result.rows[0];
        if (user && !user.suspended && !user.paused) {
          req.user = { userId: user.id, nick: user.nick, isAdmin: user.is_admin };
        } else {
          // Korisnik je suspendiran, pauziran ili obrisan - odmah poništi sesiju, ne čekaj istek JWT-a
          res.clearCookie(process.env.COOKIE_NAME || 'exyu_session');
        }
      } catch (err) {
        console.error('Greška provjere korisnika u attachUser:', err.message);
      }
    }
  }
  next();
}

// Blokira zahtjev ako korisnik nije prijavljen.
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Niste prijavljeni.' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Nemate ovlasti za ovu radnju.' });
  }
  next();
}

module.exports = { attachUser, requireAuth, requireAdmin };
