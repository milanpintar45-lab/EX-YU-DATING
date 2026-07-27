const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { STRIPE_ENABLED } = require('../services/payments');

const router = express.Router();
router.use(requireAuth, requireAdmin); // SVE rute ovdje - samo admin

// ============================================
// GET /api/naplata/status - je li Stripe aktiviran
// ============================================
router.get('/status', (req, res) => {
  res.json({ stripeEnabled: STRIPE_ENABLED });
});

// ============================================
// GET /api/naplata/stats - stvarna statistika (0 dok nema uplata, ali upit je pravi)
// ============================================
router.get('/stats', async (req, res) => {
  const monthRevenue = await db.query(
    `SELECT COALESCE(SUM(amount_cents), 0) AS total FROM payments
     WHERE status = 'succeeded' AND created_at >= date_trunc('month', now())`
  );
  const totalRevenue = await db.query(
    `SELECT COALESCE(SUM(amount_cents), 0) AS total FROM payments WHERE status = 'succeeded'`
  );
  const activeSubs = await db.query(
    `SELECT count(*) FROM subscriptions WHERE status = 'active'`
  );
  res.json({
    monthRevenueCents: Number(monthRevenue.rows[0].total),
    totalRevenueCents: Number(totalRevenue.rows[0].total),
    activeSubscriptions: Number(activeSubs.rows[0].count),
  });
});

// ============================================
// GET /api/naplata/payments - lista uplata (prazna dok se ne aktivira naplata)
// ============================================
router.get('/payments', async (req, res) => {
  const result = await db.query(
    `SELECT p.id, p.amount_cents, p.currency, p.status, p.description, p.created_at,
            COALESCE(u.nick, p.user_nick_snapshot) AS nick
     FROM payments p LEFT JOIN users u ON u.id = p.user_id
     ORDER BY p.created_at DESC LIMIT 200`
  );
  res.json({ payments: result.rows });
});

// ============================================
// GET /api/naplata/plans - lista planova
// ============================================
router.get('/plans', async (req, res) => {
  const result = await db.query('SELECT * FROM subscription_plans ORDER BY price_cents ASC');
  res.json({ plans: result.rows });
});

// ============================================
// POST /api/naplata/plans - dodaj novi plan (npr. "VIP mjesečno", 9.99 EUR)
// ============================================
router.post('/plans', async (req, res) => {
  const { name, priceCents, currency, interval } = req.body;
  if (!name || !priceCents) return res.status(400).json({ error: 'Naziv i cijena su obavezni.' });
  const insert = await db.query(
    `INSERT INTO subscription_plans (name, price_cents, currency, interval) VALUES ($1,$2,$3,$4) RETURNING *`,
    [name, priceCents, currency || 'EUR', interval || 'month']
  );
  res.json({ ok: true, plan: insert.rows[0] });
});

// ============================================
// DELETE /api/naplata/plans/:id
// ============================================
router.delete('/plans/:id', async (req, res) => {
  await db.query('DELETE FROM subscription_plans WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
