const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.warn(
      '⚠️  SMTP nije konfiguriran (.env) - emailovi se NEĆE stvarno slati, samo ispisivati u konzolu.'
    );
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

async function sendVerificationEmail(toEmail, code) {
  const t = getTransporter();
  const subject = 'EX YU DATING - Kod za potvrdu emaila';
  const html = `
    <div style="font-family:sans-serif;padding:20px;">
      <h2>Potvrda email adrese</h2>
      <p>Vaš kod za potvrdu je:</p>
      <p style="font-size:28px;font-weight:bold;letter-spacing:4px;">${code}</p>
      <p>Kod vrijedi 10 minuta. Ako niste vi tražili ovaj kod, slobodno zanemarite ovaj email.</p>
    </div>
  `;

  if (!t) {
    // Fallback način rada dok SMTP nije postavljen - NE koristiti u produkciji.
    console.log(`[DEV] Email kod za ${toEmail}: ${code}`);
    return { simulated: true };
  }

  return t.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: toEmail,
    subject,
    html,
  });
}

async function sendPasswordResetEmail(toEmail, code) {
  const t = getTransporter();
  const html = `
    <div style="font-family:sans-serif;padding:20px;">
      <h2>Oporavak lozinke - EX YU DATING</h2>
      <p>Vaš kod za oporavak lozinke je:</p>
      <p style="font-size:28px;font-weight:bold;letter-spacing:4px;">${code}</p>
      <p>Kod vrijedi 10 minuta. Ako niste vi tražili oporavak lozinke, odmah promijenite lozinku ili kontaktirajte podršku.</p>
    </div>
  `;

  if (!t) {
    console.log(`[DEV] Reset kod za ${toEmail}: ${code}`);
    return { simulated: true };
  }

  return t.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: toEmail,
    subject: 'EX YU DATING - Oporavak lozinke',
    html,
  });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
