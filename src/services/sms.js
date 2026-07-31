let client = null;

function normalizePhone(phone) {
  let p = String(phone).trim().replace(/[\s()-]/g, '');
  if (p.startsWith('00')) p = '+' + p.slice(2);
  if (p.startsWith('0') && !p.startsWith('+')) p = '+385' + p.slice(1);
  if (!p.startsWith('+')) p = '+' + p;
  return p;
}

function getClient() {
  if (client) return client;

  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.warn(
      '⚠️  Twilio nije konfiguriran (.env) – SMS se NEĆE stvarno slati, samo ispisivati u konzolu.\n' +
      '   Napomena: Twilio brojevi za HR/BA/RS mogu biti skuplji ili ograničeni –\n' +
      '   za lokalno tržište razmisli i o Infobipu, koji ima bolju pokrivenost regije.'
    );
    return null;
  }

  const twilio = require('twilio');
  client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  return client;
}

async function sendVerificationSms(toPhone, code) {
  toPhone = normalizePhone(toPhone);
  const c = getClient();
  const body = `EX YU DATING – vaš kod za potvrdu broja: ${code} (vrijedi 10 min)`;

  if (!c) {
    console.log(`[DEV] SMS kod za ${toPhone}: ${code}`);
    return { simulated: true };
  }

  return c.messages.create({
    body,
    from: process.env.TWILIO_FROM_NUMBER,
    to: toPhone,
  });
}

module.exports = { sendVerificationSms };