-- ============================================
-- EX YU DATING - shema baze (PostgreSQL)
-- ============================================

CREATE TABLE IF NOT EXISTS users (
  id                  SERIAL PRIMARY KEY,
  nick                VARCHAR(50) UNIQUE NOT NULL,
  nick2               VARCHAR(50),                 -- samo za "par" profile
  email               VARCHAR(255) UNIQUE NOT NULL,
  phone               VARCHAR(30),
  password_hash       TEXT NOT NULL,
  gender              CHAR(1) NOT NULL,             -- m / z / p
  seek_gender         CHAR(1) NOT NULL,
  country             VARCHAR(2) NOT NULL,          -- hr / ba / rs
  city                VARCHAR(100) NOT NULL,
  birth_date          DATE NOT NULL,

  email_verified      BOOLEAN NOT NULL DEFAULT FALSE,
  phone_verified      BOOLEAN NOT NULL DEFAULT FALSE,
  voice1_confirmed    BOOLEAN NOT NULL DEFAULT FALSE,
  voice2_confirmed    BOOLEAN NOT NULL DEFAULT FALSE,

  is_admin            BOOLEAN NOT NULL DEFAULT FALSE,
  status              VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending / approved / rejected
  suspended           BOOLEAN NOT NULL DEFAULT FALSE, -- admin suspend/unsuspend (odvojeno od pending/approved)
  paused              BOOLEAN NOT NULL DEFAULT FALSE, -- korisnik SAM privremeno pauzira račun (odmor od aplikacije) - podaci ostaju, profil je skriven dok se ne vrati
  last_seen_at        TIMESTAMPTZ,             -- za "online" status (ažurira se pingom s klijenta)
  consent_accepted_at TIMESTAMPTZ,
  consent_details     JSONB,           -- { "age": true, "explicit": true, ... } - koji su checkboxovi potvrđeni
  consent_ip          VARCHAR(45),     -- IP adresa u trenutku prihvaćanja, za dokazivanje kasnije

  -- Detaljni profil (uređuje se na profil.html) - odvojeno od osnovnih registracijskih polja
  display_name        VARCHAR(100),
  profile_gender       VARCHAR(10),   -- m / z / par / par-mm / par-zz (detaljnije od registracijskog 'gender')
  partner_age          INT,           -- dob drugog partnera kod parova (samoprijavljeno, nije verificirano)
  seeking               VARCHAR(10),   -- z / m / par / svi (detaljnije od registracijskog seek_gender)
  height_range         VARCHAR(20),
  weight_range         VARCHAR(20),
  hair_color            VARCHAR(20),
  eye_color              VARCHAR(20),
  orientation           VARCHAR(20),
  relationship_status  VARCHAR(20),
  bio                    TEXT,
  personal_message       TEXT,
  avatar_url             TEXT,          -- data URL - jednostavno rješenje dok se ne doda pravi file storage (S3 i sl.)
  block_pokes            BOOLEAN NOT NULL DEFAULT FALSE,
  contact_restriction  VARCHAR(10) NOT NULL DEFAULT 'svi', -- 'svi' ili 'match' (koristi settings.html)
  profile_visibility  VARCHAR(10) NOT NULL DEFAULT 'svi',  -- 'svi' ili 'match' - tko vidi profil
  show_online_status  BOOLEAN NOT NULL DEFAULT TRUE,
  browser_notifications BOOLEAN NOT NULL DEFAULT FALSE, -- korisnik SAM uključuje - obavijesti preglednika za poruke/bockanja/zahtjeve
  extra_settings      JSONB NOT NULL DEFAULT '{}'::jsonb, -- notifMatch/notifLike/notifMsg i sl. (samo spremljeno, kao i u originalu)

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Verifikacijski kodovi (email / SMS) - kratkotrajni, brišu se nakon korištenja
CREATE TABLE IF NOT EXISTS verification_codes (
  id          SERIAL PRIMARY KEY,
  target      VARCHAR(255) NOT NULL,     -- email adresa ili broj telefona
  code_hash   TEXT NOT NULL,             -- kod se NE sprema u čistom tekstu
  type        VARCHAR(10) NOT NULL,      -- 'email' ili 'phone'
  attempts    INT NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_target ON verification_codes(target, type);

-- Password reset tokeni
CREATE TABLE IF NOT EXISTS password_resets (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash   TEXT NOT NULL,
  attempts    INT NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Poruke između korisnika (uključujući "obrati se adminu" widget)
CREATE TABLE IF NOT EXISTS messages (
  id           SERIAL PRIMARY KEY,
  from_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(from_user_id, to_user_id, created_at);

-- Prijave korisnika (report)
CREATE TABLE IF NOT EXISTS reports (
  id            SERIAL PRIMARY KEY,
  from_user_id  INT REFERENCES users(id) ON DELETE SET NULL,
  to_user_id    INT REFERENCES users(id) ON DELETE SET NULL,
  from_nick_snapshot VARCHAR(50) NOT NULL, -- nick prijavitelja u trenutku prijave - preživi i ako se račun kasnije obriše
  to_nick_snapshot   VARCHAR(50) NOT NULL, -- nick prijavljenog u trenutku prijave - isto
  reason        TEXT NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending / reviewed / dismissed
  sanction      VARCHAR(20),             -- NULL / suspended / kicked - bilježi je li i kakva sankcija poduzeta
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Blokiranje korisnika (jednosmjerno spremljeno, ali se primjenjuje simetrično u prikazu)
CREATE TABLE IF NOT EXISTS blocks (
  blocker_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);

-- Notifikacije (prijave adminu, itd. - odvojeno od privatnih poruka)
CREATE TABLE IF NOT EXISTS notifications (
  id           SERIAL PRIMARY KEY,
  user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type         VARCHAR(20) NOT NULL,     -- report / msg / match / like / poke
  text         TEXT NOT NULL,
  from_nick    VARCHAR(50),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read_at);

-- Javni "chat po državi" (grupna soba po hr/ba/rs) - koriste hrvatska/bosna/srbija.html
-- i prosireni-chat.html
CREATE TABLE IF NOT EXISTS country_chat_messages (
  id           SERIAL PRIMARY KEY,
  country      VARCHAR(2) NOT NULL,
  from_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_country_chat ON country_chat_messages(country, created_at);

-- Galerija/video - SAMO metapodaci (placeholder stavke s privatnošću), original nikad
-- nije spremao stvarne datoteke; pravi upload je sljedeći korak ako zatreba.
CREATE TABLE IF NOT EXISTS photos (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  privacy    VARCHAR(10) NOT NULL DEFAULT 'javno', -- javno / matchevi / privatno
  data_url   TEXT,        -- base64 slika (jednostavno rješenje dok se ne doda pravi file storage)
  owner_reaction VARCHAR(10), -- 'like' / 'pass' / NULL - vlasnikova osobna oznaka, SAMO u galerija.html
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS videos (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  privacy    VARCHAR(10) NOT NULL DEFAULT 'javno',
  data_url   TEXT,        -- base64 video (isto - privremeno rješenje)
  owner_reaction VARCHAR(10), -- 'like' / 'pass' / NULL - vlasnikova osobna oznaka, SAMO u galerija.html
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Video pozivi na čekanju (za "zvonjenje")
CREATE TABLE IF NOT EXISTS calls (
  id             SERIAL PRIMARY KEY,
  from_user_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room           VARCHAR(100) NOT NULL,
  status         VARCHAR(15) NOT NULL DEFAULT 'ringing', -- ringing / accepted / declined / missed
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_calls_to ON calls(to_user_id, status);

-- Bockanja (poke)
CREATE TABLE IF NOT EXISTS pokes (
  id           SERIAL PRIMARY KEY,
  from_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Mečevi (za sad strukturno pripremljeno - nema još UI-a koji ih stvara,
-- isto kao u originalnom kodu gdje se exyu_matches čita ali nikad ne piše)
CREATE TABLE IF NOT EXISTS matches (
  id          SERIAL PRIMARY KEY,
  user_a_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Oglasnik (oglasnik.html) - male oglasi korisnika
CREATE TABLE IF NOT EXISTS ads (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  country     VARCHAR(2) NOT NULL,    -- hr / ba / rs - automatski iz profila oglašivača
  category    VARCHAR(30) NOT NULL,   -- npr. on-trazi-nju, zenidba-udaja, itd.
  title       VARCHAR(200) NOT NULL,
  body        TEXT NOT NULL,
  poster_gender VARCHAR(10) NOT NULL, -- m / z / par (oblik oglašivača, može se razlikovati od profila kod para)
  age_range   VARCHAR(10),
  city        VARCHAR(100),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ads_created ON ads(created_at DESC);

-- Site-wide postavke izgleda (npr. hero banner slika po državi) - admin ih mijenja
-- putem drag&drop na stranici, svi korisnici ih samo čitaju
CREATE TABLE IF NOT EXISTS site_assets (
  key        VARCHAR(50) PRIMARY KEY,  -- npr. 'hero-hr', 'hero-ba', 'hero-rs'
  data_url   TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ads_country ON ads(country);

-- ============================================
-- NAPLATA - spremno za buduću aktivaciju (vidi src/services/payments.js za Stripe upute)
-- ============================================

-- Planovi pretplate (admin ih uređuje kad se odluči na naplatu)
CREATE TABLE IF NOT EXISTS subscription_plans (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(50) NOT NULL,       -- npr. "VIP mjesečno", "VIP godišnje"
  price_cents INT NOT NULL,               -- cijena u centima (npr. 999 = 9.99)
  currency    VARCHAR(3) NOT NULL DEFAULT 'EUR',
  interval    VARCHAR(10) NOT NULL DEFAULT 'month', -- month / year
  active      BOOLEAN NOT NULL DEFAULT true,
  stripe_price_id VARCHAR(100),           -- popuni kad se poveže pravi Stripe price
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pretplate korisnika na plan
CREATE TABLE IF NOT EXISTS subscriptions (
  id                SERIAL PRIMARY KEY,
  user_id           INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id           INT NOT NULL REFERENCES subscription_plans(id),
  status            VARCHAR(20) NOT NULL DEFAULT 'active', -- active / canceled / past_due
  stripe_subscription_id VARCHAR(100),
  current_period_end    TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);

-- Pojedinačne uplate/transakcije
CREATE TABLE IF NOT EXISTS payments (
  id             SERIAL PRIMARY KEY,
  user_id        INT REFERENCES users(id) ON DELETE SET NULL,
  user_nick_snapshot VARCHAR(50),         -- nick u trenutku uplate, preživi brisanje korisnika
  amount_cents   INT NOT NULL,
  currency       VARCHAR(3) NOT NULL DEFAULT 'EUR',
  status         VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending / succeeded / failed / refunded
  provider       VARCHAR(20) NOT NULL DEFAULT 'stripe',
  provider_payment_id VARCHAR(150),       -- Stripe PaymentIntent/Charge ID
  description    VARCHAR(200),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);

-- Zahtjevi za prijateljstvo
CREATE TABLE IF NOT EXISTS friend_requests (
  id           SERIAL PRIMARY KEY,
  from_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       VARCHAR(10) NOT NULL DEFAULT 'pending', -- pending / accepted / declined
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(from_user_id, to_user_id)
);
CREATE INDEX IF NOT EXISTS idx_friend_requests_to ON friend_requests(to_user_id, status);

-- Pokloni
CREATE TABLE IF NOT EXISTS gifts (
  id           SERIAL PRIMARY KEY,
  from_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gift_type    VARCHAR(20) NOT NULL, -- ruza / srce / dijamant / medvjedic / sampanjac
  message      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gifts_to ON gifts(to_user_id, created_at DESC);

-- Blokade nakon previše pogrešnih pokušaja (po nick/email, ne po IP - IP blok radi se u middlewareu)
CREATE TABLE IF NOT EXISTS login_blocks (
  identifier  VARCHAR(255) PRIMARY KEY,   -- nick ili email
  blocked_until TIMESTAMPTZ NOT NULL
);

-- Zapis svakog pogrešnog pokušaja prijave (po računu) - koristi se za brojanje unutar 15 min prozora
CREATE TABLE IF NOT EXISTS login_fail_log (
  id         SERIAL PRIMARY KEY,
  identifier VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_login_fail_log ON login_fail_log(identifier, created_at DESC);