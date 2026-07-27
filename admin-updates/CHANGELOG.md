# EX YU DATE — Ažuriranja servera

Ova mapa prati sva buduća poboljšanja backend/servera nakon inicijalnog
prebacivanja s localStorage-a na pravi Node.js/Express/PostgreSQL backend.
Svaki novi krug promjena dodaje se kao novi unos na vrhu ove datoteke.

Format unosa:
```
## [DATUM] Kratki naziv promjene
- Što je dodano/promijenjeno
- Koje datoteke su zahvaćene (backend rute, sheme, frontend stranice)
- Poznata ograničenja ili sljedeći koraci
```

---

## [2026-07-25] Galerija: like/not-like, zahtjevi za prijateljstvo, pokloni
- Dodane `owner_reaction` kolone na `photos`/`videos` - vlasnik može označiti
  vlastite fotografije/videe kao "sviđa mi se" ili "ne sviđa mi se", vidljivo
  ISKLJUČIVO u `galerija.html`, nikad na `profil.html`.
- Novi sustav zahtjeva za prijateljstvo (`friend_requests` tablica,
  `/api/friends/*` rute) - zamjenjuje raniju privremenu definiciju "prijatelja"
  (korisnici iz iste države) stvarnim prihvaćenim zahtjevima.
- Novi sustav poklona (`gifts` tablica, `/api/gifts/*` rute) - 5 tipova
  poklona (ruža, srce, dijamant, medvjedić, šampanjac) s opcionalnom porukom.
- Reorganizacija zaglavlja na `pocetna.html`, `hrvatska.html`, `bosna.html`,
  `srbija.html`: gore lijevo (odjava, poruke, zahtjevi za prijateljstvo,
  pokloni), gore desno (kontakt admina, postavke), ispod postavki tri
  admin-only gumba (registracija, prva stranica, admin panel).

---

## [2026-07-25 v2] Sigurnost, oglasnik filteri, audit trag prijava, pauza računa
- **Sigurnost**: strogi CORS (bez `origin: true`), globalni rate limiter na sve API pozive,
  limiter za registraciju i za akcije spama (poruke/prijave/oglasi/pokloni/bockanja/zahtjevi),
  ograničena veličina JSON tijela (15mb).
- **Oglasnik**: dodani filteri po državi (HR/BA/RS) i regiji (županija/kanton/okrug), svi
  filteri (država + regija + spol + kategorija) sad se stvarno kombiniraju umjesto da se
  međusobno resetiraju.
- **Audit trag prijava**: `reports` tablica sad preživi brisanje korisnika (FK promijenjen
  s CASCADE na SET NULL + snapshot nickova) - admin uvijek može vidjeti povijest prijava i
  poduzetih sankcija (`sanction: kicked/suspended`), čak i nakon što je prijavljeni korisnik
  izbačen/obrisan.
- **Pauza računa**: korisnik sad može SAM privremeno pauzirati profil (odmor od aplikacije)
  bez brisanja podataka - `paused` kolona, `/api/auth/pause`, automatsko odpauziravanje pri
  sljedećoj prijavi uz poruku dobrodošlice.
- Uklonjena "Notifikacije" sekcija iz postavki (notifMatch/notifLike/notifMsg) po zahtjevu.
- Potvrđeno: shema baze je već pravilno normalizirana (users / relacije / mediji odvojeni
  tablicama s foreign key vezama), spremna za konsolidaciju servera bez gubitka podataka.

---

## [2026-07-25 v3] Obavijesti preglednika (opt-in)
- Nova postavka u `settings.html` - "Obavijesti preglednika" (isključeno po defaultu).
  Kad korisnik uključi, traži se stvarno dopuštenje preglednika (Notification API).
- Kad je uključeno, stranice s zaglavljem (Početna/Hrvatska/Bosna/Srbija/Chat/Video/Galerija)
  svakih 20s tiho provjeravaju nove poruke, bockanja i zahtjeve za prijateljstvo, i prikazuju
  pravu obavijest preglednika (izvan taba) ako se broj povećao od zadnje provjere.
- `browser_notifications` kolona na `users`, uključena u `/api/settings` GET/PUT.

### Poznato ograničenje (v3)
Ovo radi SAMO dok je stranica otvorena u pregledniku (poll na 20s). Prave "push" obavijesti
koje stižu i kad je preglednik potpuno zatvoren zahtijevaju Service Worker + Push API + VAPID
ključeve na serveru (biblioteka `web-push`) - veći zaseban zahvat ako ustreba u budućnosti.

---

## [2026-07-26] Naplata - potpuna podloga spremna za aktivaciju
- Nove tablice: `subscription_plans` (planovi pretplate), `subscriptions` (tko je pretplaćen),
  `payments` (sve uplate/transakcije, s snapshot nickom da preživi brisanje korisnika).
- Novi `src/services/payments.js` - Stripe integracija napisana i spremna, ali ISKLJUČENA
  dok se ne doda `STRIPE_SECRET_KEY` u `.env`. Sadrži korak-po-korak upute unutar datoteke.
- Nova `naplata.html` stranica (admin-only, dodana kao "💰 NAPLATA" na kraju navigacije,
  vidljiva SAMO adminu) - prikazuje stvaran prihod/pretplate/transakcije (trenutno 0, jer
  nema uplata), i omogućuje adminu da unaprijed definira planove (naziv + cijena + interval)
  čak i prije nego se Stripe aktivira.
- `/api/naplata/*` rute - sve zaštićene `requireAdmin`, rade sa stvarnim (trenutno praznim)
  podacima, ne s izmišljenim brojevima.

### Kako aktivirati kad budeš spreman/na (sve je već spremno, samo ovi koraci):
1. Napravi Stripe račun, uzmi API ključ
2. Dodaj `STRIPE_SECRET_KEY` i `STRIPE_WEBHOOK_SECRET` u `.env`
3. `npm install stripe`
4. Otkomentiraj kod u `src/services/payments.js` (jasno označen komentarima)
5. Dodaj webhook rutu u `server.js` (uputa je u istoj datoteci)

Do tad, stranica radi normalno i pokazuje transparentno da naplata "još nije aktivirana" -
ništa se ne pretvara da radi kad ne radi.

Prošao sam cijeli `admin.html` funkciju po funkciju (21 funkcija, sve povezane s pravim
gumbima, nema mrtvih/nedostajućih poziva) i backend rute (sve zaštićene `requireAdmin` -
admin ima pristup svemu, nitko drugi ničemu od toga):

- **Slike/videa**: već su prikazivali SVE (uklj. privatne/"pod šifrom") - potvrđeno, nije
  trebalo mijenjati. Admin vidi stvarni sadržaj, ne samo metapodatke.
- **Poruke**: ovo JE bio nedostatak - admin je prije mogao vidjeti samo vlastiti sandučić,
  ne i privatne razgovore između drugih korisnika. Dodao sam `/api/admin/messages` (sve
  poruke u sustavu) i `/api/admin/messages/:id` + skupno brisanje - stara "Poruke" tablica
  u adminu je bila čisti dekorativan mockup (Marko/Ana lažni razgovori), sad prikazuje
  stvarne poruke uživo.
- Korisnici, prijave (s audit tragom), profili - potvrđeno da rade ispravno.

### Napomena o privatnosti (bitno pročitati)
Davanje adminu uvida u SVE privatne poruke između korisnika je ozbiljna odluka sa stanovišta
zaštite podataka - politika privatnosti već spominje da admin pristupa sadržaju profila radi
moderacije, ali eksplicitno ne spominje čitanje privatnih razgovora. Preporuka: ili dodati tu
rečenicu u Politiku privatnosti (transparentnost prema korisnicima), ili ograničiti admin uvid
u poruke samo na one koje su dio aktivne prijave (report), ne na baš svaku poruku u sustavu.
Trenutno je implementirano najšire (sve poruke) jer je to eksplicitno traženo - javi ako želiš
suziti na "samo prijavljeno".



