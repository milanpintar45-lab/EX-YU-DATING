const SibApiV3Sdk = require('sib-api-v3-sdk');

const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

async function sendViaResend(toEmail, subject, html) {
  if (!process.env.BREVO_API_KEY) {
    console.warn('⚠️ BREVO_API_KEY nije postavljen — emailovi se NEĆE stvarno slati, samo ispisivati u konzolu.');
    return null;
  }
  const sendSmtpEmail = {
    sender: { name: 'EX YU DATING', email: 'exyudating69@gmail.com' },
    to: [{ email: toEmail }],
    subject,
    htmlContent: html,
  };
  const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
  return result;
}

async function sendVerificationEmail(toEmail, code) {
  const subject = 'EX YU DATING - Kod za potvrdu emaila';
  const html = `
    <div style="font-family:sans-serif;padding:20px;">
      <h2>Potvrda email adrese</h2>
      <p>Vaš kod za potvrdu je:</p>
      <p style="font-size:28px;font-weight:bold;letter-spacing:4px;">${code}</p>
      <p>Kod vrijedi 10 minuta. Ako niste vi tražili ovaj kod, slobodno zanemarite ovaj email.</p>
    </div>
  `;
  const result = await sendViaResend(toEmail, subject, html);
  if (!result) {
    console.log(`[DEV] Email kod za ${toEmail}: ${code}`);
    return { simulated: true };
  }
  return result;
}
async function sendPasswordResetEmail(toEmail, code) {
  const html = `
    <div style="font-family:sans-serif;padding:20px;">
      <h2>Oporavak lozinke - EX YU DATING</h2>
      <p>Vaš kod za oporavak lozinke je:</p>
      <p style="font-size:28px;font-weight:bold;letter-spacing:4px;">${code}</p>
      <p>Kod vrijedi 10 minuta. Ako niste vi tražili oporavak lozinke, odmah promijenite lozinku ili kontaktirajte podršku.</p>
    </div>
  `;
  const result = await sendViaResend(toEmail, 'EX YU DATING - Oporavak lozinke', html);
  if (!result) {
    console.log(`[DEV] Reset kod za ${toEmail}: ${code}`);
    return { simulated: true };
  }
  return result;
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };