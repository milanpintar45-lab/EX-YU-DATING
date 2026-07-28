async function sendViaResend(toEmail, subject, html) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('⚠️  RESEND_API_KEY nije postavljen - emailovi se NEĆE stvarno slati, samo ispisivati u konzolu.');
    return null;
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
      to: toEmail,
      subject,
      html,
    }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend greška: ${response.status} - ${errorText}`);
  }
  return response.json();
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