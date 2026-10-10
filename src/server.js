require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const { attachUser } = require('./middleware/auth');
const { globalApiLimiter, registerLimiter, actionLimiter } = require('./middleware/rateLimit');
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const messagesRoutes = require('./routes/messages');
const moderationRoutes = require('./routes/moderation');
const countryChatRoutes = require('./routes/countryChat');
const profileRoutes = require('./routes/profile');
const adminRoutes = require('./routes/admin');
const adsRoutes = require('./routes/ads');
const settingsRoutes = require('./routes/settings');
const friendsRoutes = require('./routes/friends');
const giftsRoutes = require('./routes/gifts');
const siteAssetsRoutes = require('./routes/siteAssets');
const naplataRoutes = require('./routes/naplata');
const callsRoutes = require('./routes/calls');
const app = express();
app.set('trust proxy', 1); // potrebno za ispravan req.ip iza reverse proxyja (nginx, Render, Railway...)
app.use(helmet({
  contentSecurityPolicy: false, // NAPOMENA: uključi kad se prebaci na vanjske skripte s nonce-ovima -
  // trenutno stranice koriste inline <script>/style= posvuda, pa bi strogi CSP odmah slomio cijeli sajt.
  // Vidi README "Sigurnosne napomene" za detalje i preporučen put naprijed.
}));
// CORS - NAMJERNO strog. Frontend i backend se serviraju s ISTE domene (nema potrebe za
// cross-origin pristupom), pa dopuštamo cross-origin zahtjeve SAMO ako je APP_URL eksplicitno
// postavljen (npr. za budući odvojeni frontend na drugoj domeni). "origin: true" bi reflektiralo
// BILO KOJU stranicu kao dopuštenu, što bi u kombinaciji s credentials:true otvorilo vrata
// cross-site napadima koji kradu sesijski cookie - zato to izbjegavamo.
app.use(cors({
  origin: process.env.APP_URL || false,
  credentials: true,
}));
// Ograničenje veličine tijela zahtjeva - sprječava da netko pošalje ogroman JSON payload
// (npr. lažnu "sliku" od nekoliko stotina MB) i preoptereti server/bazu. 15mb pokriva najveći
// dopušteni video (~11MB base64) uz razuman marginu.
app.use(express.json({ limit: '15mb' }));
app.use(cookieParser());
app.use(attachUser);
// Globalni rate limiter - druga linija obrane na SVE API pozive (osim health checka),
// neovisno o specifičnim, strožim limiterima na pojedinim rutama (login, registracija, itd.)
app.use('/api', globalApiLimiter);
// Statičke datoteke (index.html, pages/*)
// VAŽNO (popravak "stare verzije sajta"): HTML stranice i sw.js MORAJU se uvijek
// iznova provjeriti sa serverom prije prikaza - bez ovoga preglednik sam "nagađa"
// i zna satima/danima prikazivati staru spremljenu verziju bez ikakvog pitanja
// serveru, čak i kad je na serveru već postavljena nova verzija koda.
// Mobitel prikazuje stranicu kao na laptopu (sirina 1200), pa se priblizava prstima.
const fs = require('fs');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
app.get(/^\/$|\.html$/, (req, res, next) => {
  let rel;
  try { rel = req.path === '/' ? 'index.html' : decodeURIComponent(req.path).replace(/^\/+/, ''); } catch (e) { return next(); }
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return next();
  fs.readFile(file, 'utf8', (err, html) => {
    if (err) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.type('html').send(html.replace(/<meta\s+name="viewport"[^>]*>/i, '<meta name="viewport" content="width=1200">'));
  });
});
app.use(express.static(path.join(__dirname, '..', 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html') || filePath.endsWith('sw.js')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/moderation', moderationRoutes);
app.use('/api/country-chat', countryChatRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ads', adsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/gifts', giftsRoutes);
app.use('/api/site-assets', siteAssetsRoutes);
app.use('/api/naplata', naplataRoutes);
app.use('/api/calls', callsRoutes);
app.get('/api/health', (req, res) => res.json({ ok: true }));
// Generički error handler - ne otkriva stack trace klijentu u produkciji
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Došlo je do greške na serveru. Pokušajte kasnije.' });
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ EX YU DATING server radi na portu ${PORT}`);
});
