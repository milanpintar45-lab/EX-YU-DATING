// ============================================
// PAYMENTS SERVICE - spremno za Stripe, trenutno isključeno
// ============================================
//
// KAKO AKTIVIRATI PRAVU NAPLATU (kad budeš spreman/na):
//
// 1. Napravi Stripe račun na https://dashboard.stripe.com/register
// 2. U Stripe dashboardu: Products → napravi proizvod (npr. "VIP mjesečno"),
//    zapamti "Price ID" (izgleda kao "price_1Abc...")
// 3. U bazi, u tablicu `subscription_plans`, dodaj red s tim stripe_price_id
//    (ili kroz admin naplata.html kad se doda forma za to)
// 4. U .env datoteku dodaj:
//      STRIPE_SECRET_KEY=sk_live_...  (ili sk_test_... za testiranje)
//      STRIPE_WEBHOOK_SECRET=whsec_...
// 5. Instaliraj Stripe SDK:  npm install stripe
// 6. Otkomentiraj kod ispod (već je napisan i spreman, samo čeka pravi ključ)
// 7. U Stripe dashboardu, Webhooks → dodaj endpoint: https://tvoja-domena.com/api/webhooks/stripe
//    (ruta za webhook treba se dodati u server.js kad se aktivira - vidi komentar dolje)
//
// Dok STRIPE_SECRET_KEY nije postavljen, sve funkcije ispod samo vraćaju
// jasnu grešku umjesto da pokušaju stvarnu naplatu - aplikacija neće pući,
// samo naplata neće raditi dok se ne aktivira.

const STRIPE_ENABLED = !!process.env.STRIPE_SECRET_KEY;

let stripe = null;
if (STRIPE_ENABLED) {
  // Otkomentiraj nakon "npm install stripe":
  // stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

// ============================================
// createCheckoutSession(plan, user) - vraća URL na koji se korisnik šalje da plati
// ============================================
async function createCheckoutSession(plan, user) {
  if (!STRIPE_ENABLED) {
    throw new Error('Naplata još nije aktivirana (nema STRIPE_SECRET_KEY u .env). Vidi src/services/payments.js za upute.');
  }
  // Kad se aktivira, ovo postaje:
  //
  // const session = await stripe.checkout.sessions.create({
  //   mode: plan.interval ? 'subscription' : 'payment',
  //   line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
  //   customer_email: user.email,
  //   success_url: `${process.env.APP_URL}/pages/naplata.html?success=1`,
  //   cancel_url: `${process.env.APP_URL}/pages/naplata.html?canceled=1`,
  //   metadata: { userId: user.id, planId: plan.id },
  // });
  // return session.url;
  throw new Error('createCheckoutSession nije implementiran - otkomentiraj kod u payments.js nakon postavljanja Stripe ključa.');
}

// ============================================
// verifyWebhookAndHandle(rawBody, signature) - poziva se iz webhook rute
// ============================================
async function verifyWebhookAndHandle(rawBody, signature, db) {
  if (!STRIPE_ENABLED) {
    throw new Error('Naplata nije aktivirana.');
  }
  // const event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  // switch (event.type) {
  //   case 'checkout.session.completed': {
  //     const session = event.data.object;
  //     await db.query(
  //       `INSERT INTO payments (user_id, amount_cents, currency, status, provider, provider_payment_id, description)
  //        VALUES ($1, $2, $3, 'succeeded', 'stripe', $4, $5)`,
  //       [session.metadata.userId, session.amount_total, session.currency.toUpperCase(), session.payment_intent, 'Checkout']
  //     );
  //     break;
  //   }
  //   // ... ostali eventovi (subscription.updated, invoice.payment_failed, itd.)
  // }
  throw new Error('verifyWebhookAndHandle nije implementiran - otkomentiraj kod nakon postavljanja Stripe ključa.');
}

module.exports = { STRIPE_ENABLED, createCheckoutSession, verifyWebhookAndHandle };
