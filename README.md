# EX YU DATING - Backend

## Što je napravljeno

Frontend (`public/index.html`) više NE koristi `localStorage` kao "bazu". Umjesto toga
razgovara s pravim Express API-jem koji:

- hashira lozinke (bcrypt, 12 rundi) - nikad se ne spremaju u čistom tekstu
- šalje stvarne email/SMS kodove (nodemailer / Twilio) umjesto da ih ispisuje u alertu
- provjerava SVE (email, telefon, glasovna provjera, suglasnosti) i na serveru, ne samo
  na frontendu - frontend provjere služe samo za bolji UX, ne kao sigurnosna mjera
- koristi httpOnly cookie sesije (JWT) umjesto spremanja lozinke u localStorage
- sprema detaljnu suglasnost (koji checkbox, kad, s koje IP adrese) - bitno za pravnu
  dokumentaciju s obzirom da platforma sadrži eksplicitni sadržaj za odrasle
- admin lozinka više NIJE u kodu - kreira se `seed` skriptom iz `.env` varijable

## Kako vidjeti cijeli sajt uživo (najlakši način)

Ovo je izvorni kod - da bi ga vidio/la kao pravu web stranicu u pregledniku, negdje mora
raditi i server i baza podataka. Otvaranje HTML datoteka direktno u pregledniku **neće
raditi** jer se svaka stranica oslanja na backend.

Najjednostavniji besplatni način (bez instaliranja išta na svoj računalo):

1. Napravi besplatan račun na **[render.com](https://render.com)** (ne treba kartica).
2. Stavi ovaj folder (`exyu-backend`) na GitHub (ili zamoli nekoga da ti pomogne to
   napraviti - treba ti samo GitHub račun i "New repository" + prevuci datoteke).
3. U Renderu klikni **New → Blueprint**, poveži taj GitHub repo. Render će automatski
   pročitati `render.yaml` datoteku (već je u projektu) i sam postaviti i server i bazu.
4. Za par minuta dobit ćeš pravi link (npr. `https://exyu-date.onrender.com`) na kojem je
   cijeli sajt uživo, uključivo registraciju, chat, admin panel - sve.

**Napomena o besplatnom planu:** besplatni Render server "zaspi" nakon 15 min neaktivnosti
(prvo sljedeće otvaranje traje ~30-60 sek dok se probudi), a besplatna baza ima ograničen
rok trajanja pa ju treba nadograditi na plaćeni plan (par dolara mjesečno) prije stvarnog
lansiranja. Za probu i pregled je besplatni plan sasvim dovoljan.

**Email/SMS kodovi:** dok ne dodaš stvarne SMTP/Twilio podatke u Render (Environment tab),
kodovi za potvrdu emaila/telefona neće stvarno stizati - vidjet ćeš to samo u server logu.
Za pravo testiranje registracije, dodaj barem SMTP podatke (vidi `.env.example`).

## Postavljanje (lokalno)

```bash
cd exyu-backend
npm install
cp .env.example .env
# uredi .env: DATABASE_URL, JWT_SECRET, SMTP_*, TWILIO_* (ili ostavi prazno za dev mod
# gdje se kodovi samo ispisuju u konzolu servera)

npm run migrate       # kreira tablice u bazi
npm run seed:admin    # kreira admin račun iz ADMIN_NICK/ADMIN_PASSWORD u .env

npm run dev           # pokreće server na http://localhost:3000
```

Otvori `http://localhost:3000` - poslužuje se ista `index.html`, ali sad zove pravi API.

## Bitne napomene prije produkcije

1. **JWT_SECRET** - generiraj s `openssl rand -hex 64`, nikad ne koristi vrijednost iz primjera.
2. **SMTP / Twilio** - dok nisu postavljeni u `.env`, kodovi se samo ispisuju u server
   konzolu (korisno za testiranje, ali NIKO neće stvarno primiti email/SMS). Prije
   lansiranja obavezno postavi stvarne kredencijale.
3. **Twilio pokrivenost regije** - za HR/BA/RS brojeve provjeri cijene i pouzdanost;
   Infobip je alternativa s boljom regionalnom pokrivenošću ako Twilio bude prekup ili
   nepouzdan za lokalne mreže.
4. **Glasovna provjera (Web Speech API)** ostaje isključivo na klijentu - to je i dalje
   UX friction, ne kriptografski dokaz identiteta ili dobi. Netko tehnički potkovan i
   dalje može preskočiti/manipulirati proces u browseru. Ako ti treba stvarna provjera
   identiteta/dobi, razmisli o specijaliziranom ID-verifikacijskom provideru (npr.
   Veriff, Yoti) - to je posebna integracija, javi ako želiš da to istražimo.
5. **Provjera profila prije odobrenja** - svaki novi korisnik ulazi sa statusom
   `pending`. Trenutno nema admin panela za pregled/odobravanje - to je sljedeći
   prirodan korak (posebna stranica koju spominješ, npr. `pages/pocetna.html` i admin
   dio).
6. **HTTPS obavezan** - `secure: true` na cookieju (postavljeno kad je `NODE_ENV=production`)
   znači da cookie NEĆE raditi bez HTTPS-a. Osiguraj TLS certifikat (Let's Encrypt/hosting).
7. **Pravna strana eksplicitnog sadržaja i dobi korisnika** - checkbox "potvrđujem da
   sam punoljetan/na" je samoprijava (self-attestation), ne stvarna provjera. Za
   platformu ovog tipa vrijedi provjeriti s pravnikom je li to dovoljno u jurisdikcijama
   gdje planiraš djelovati (HR/BA/RS + eventualno EU dijaspora), i razmisliti o
   dodatnoj provjeri dobi ako zakon to zahtijeva.

## API pregled

| Metoda | Ruta | Opis |
|---|---|---|
| POST | `/api/auth/send-email-code` | šalje kod na email |
| POST | `/api/auth/verify-email-code` | potvrđuje kod, vraća `ticket` |
| POST | `/api/auth/send-phone-code` | šalje SMS kod |
| POST | `/api/auth/verify-phone-code` | potvrđuje kod, vraća `ticket` |
| POST | `/api/auth/register` | finalna registracija (traži oba tiketa + consents + birthDate) |
| POST | `/api/auth/login` | prijava, postavlja httpOnly cookie |
| POST | `/api/auth/logout` | briše cookie |
| GET  | `/api/auth/me` | vraća trenutno prijavljenog korisnika |
| POST | `/api/auth/change-password` | promjena lozinke (traži staru) |
| DELETE | `/api/auth/me` | korisnik briše vlastiti račun |
| POST | `/api/auth/forgot-password/request` \| `/verify` \| `/reset` | oporavak lozinke, 3 koraka |
| GET  | `/api/users` | lista korisnika (filteri: country, region, gender, age, online, search) |
| GET  | `/api/users/stats` | brojevi online/žene/muškarci/parovi |
| GET  | `/api/users/friends-count` | broj "prijatelja" (ista država) |
| POST | `/api/users/presence-ping` | javlja da je korisnik aktivan (online status) |
| DELETE | `/api/users/:nick` | admin - trajno briše korisnika |
| POST | `/api/messages` | pošalji poruku |
| GET  | `/api/messages/inbox` \| `/unread-count` \| `/conversations` \| `/thread/:nick` | dohvat poruka |
| DELETE | `/api/messages/:id` | briši vlastitu poruku |
| GET/POST | `/api/country-chat` | javni chat po državi (koriste hrvatska/bosna/srbija/prosireni-chat) |
| POST | `/api/moderation/report` \| `/block` \| `/poke` | prijavi/blokiraj/bocni korisnika |
| GET  | `/api/moderation/blocked` \| `/pokes` \| `/notifications` | dohvat vlastitih podataka |
| DELETE | `/api/moderation/block/:nick` | odblokiraj |
| GET/PUT | `/api/profile/me` | vlastiti profil |
| GET  | `/api/profile/:nick` | javni pregled profila (poštuje privatnost/blokove) |
| POST | `/api/profile/avatar` | promjena profilne slike |
| POST/PATCH/DELETE | `/api/profile/photos/:id` \| `/videos/:id` | galerija/video (privatnost po stavci) |
| GET/PUT | `/api/settings` | postavke privatnosti i notifikacija |
| GET/POST/DELETE | `/api/ads` | oglasnik |
| GET  | `/api/admin/users` \| `/reports` \| `/media` | admin pregled |
| POST | `/api/admin/users/:nick/approve\|reject\|suspend\|unsuspend` | admin upravljanje korisnicima |
| POST | `/api/admin/broadcast` | admin poruka svim korisnicima |

## Status po stranicama - SVIH 20 GOTOVO

Sve stranice su spojene na pravi backend (nula `localStorage` korištenja za stvarne podatke,
osim jednog bezopasnog UI dev-flaga u `index.html`):

- `index.html` — registracija/login, stvarni datum rođenja + server-side 18+ provjera
- `pocetna.html`, `na-mrezi.html`, `svi-korisnici.html`, `chat.html`, `prosireni-chat.html`
- `hrvatska.html`, `bosna.html`, `srbija.html` — s ispravnim grad→županija/kanton/okrug mapiranjem
- `profil.html` — uklonjen lažni katalog od 37 demo profila
- `admin.html` — server-side provjera pristupa, odobravanje/odbijanje registracija (nedostajalo u originalu)
- `galerija.html` — ispravljen bug gdje je galerija bila globalna umjesto po korisniku
- `oglasnik.html` — izgrađen stvaran sustav oglasa (original je bio čisti UI mockup)
- `video.html` — Jitsi Meet pozivi (već radili), samo kontakt lista spojena na prave korisnike
- `settings.html` — bcrypt promjena lozinke, stvarno brisanje računa, primijenjene postavke privatnosti
- `politika-privatnosti.html`, `pravila-zajednice.html`, `uvjeti-koristenja.html`, `video-registracija.html` — statične, bez izmjena
- `dokumentacija.html`, `ex-yu-date-dokumentacija.html` — samo FAB/friends-count widget

## Arhitektura: već spremna za "3 servera → 1 server" konsolidaciju

Aplikacija **ne koristi 3 odvojena servera/baze za HR/BA/RS** - od samog početka
gradili smo je kao **jedan Express backend + jedna PostgreSQL baza**, gdje je
država samo obična kolona (`country: 'hr'|'ba'|'rs'`) na retku korisnika,
poruke, oglasa itd. To znači:

- Nema odvojenih shema ni baza po državi - svi upiti (`/api/users`,
  `/api/country-chat`, itd.) filtriraju po `country` koloni unutar iste baze.
- Ako trenutno *hostate* 3 odvojena servera (npr. jedan po državi radi
  opterećenja ili povijesnih razloga), prelazak na 1 server znači samo:
  1. Izvesti podatke iz sve 3 baze (`pg_dump`) i uvesti u jednu zajedničku bazu
     (`pg_restore`/`COPY`), pazeći da se `id` sekvence ne sudaraju (najlakše:
     dodati privremeni prefiks ili koristiti `ON CONFLICT DO NOTHING` uz
     ručnu provjeru duplikata po `email`/`nick`).
  2. Pokrenuti jedan backend proces s `DATABASE_URL` koji pokazuje na tu
     zajedničku bazu.
  3. Sve tri domene (ili poddomene) samo preusmjeriti na taj jedan server.
- Nema koda koji pretpostavlja "svoj poseban server po državi" - filtriranje
  je uvijek preko `country` parametra u upitu, nikad preko posebne konekcije.

Ukratko: **arhitektura je već napravljena tako da nikad ne bi ni trebalo imati
3 servera** za ovu funkcionalnost - ako ih trenutno imate, konsolidacija je
uglavnom posao migracije podataka (korak 1 gore), ne posao mijenjanja koda.

## Poznata ograničenja i preporuke prije produkcije

1. **Slike/video u bazi kao base64** (`photos`/`videos`/`avatar_url` kolone) - radi, ali nije
   skalabilno. Za produkciju: premjestiti na S3/R2/Cloudinary i spremati samo URL.
2. **Dashboard statistika u `admin.html`** (2.847 korisnika, grafovi) - dekorativan placeholder,
   nije spojen na stvarne podatke (isto kao u originalu).
3. **"Potrošnja i upozorenja" panel** - originalni kod ga eksplicitno označava kao primjer
   podataka; treba spojiti na stvarni hosting/DB usage API ako se želi koristiti.
4. **Matches (mečevi)** - tablica postoji, ali nema UI-a koji ih stvara (isto kao u originalu -
   `exyu_matches` se čitao, ali nikad pisao). Treba dodati "swipe/like" mehaniku ako se želi
   koristiti opcija "samo matchevi" za privatnost/kontakt.

## Sljedeći koraci (za "idemo dalje")

Sve stranice iz originalnog projekta su obrađene - nema više preostalih. Ako se doda nova
stranica ili funkcija, prati isti princip: pravi API poziv umjesto `localStorage`, server-side
validacija uz klijentsku, i sintaksna provjera (`node --check`) prije predaje.
