const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const ALLOWED = ['svi', 'match'];

// ============================================
// GET /api/settings
// ============================================
router.get('/', requireAuth, async (req, res) => {
  const result = await db.query(
    'SELECT contact_restriction, profile_visibility, show_online_status, browser_notifications FROM users WHERE id = $1',
    [req.user.userId]
  );
  const u = result.rows[0];
  res.json({
    visibility: u.profile_visibility,
    contact: u.contact_restriction,
    online: u.show_online_status ? 'da' : 'ne',
    browserNotifications: u.browser_notifications,
  });
});

// ============================================
// PUT /api/settings
// ============================================
router.put('/', requireAuth, async (req, res) => {
  const { visibility, contact, online, browserNotifications } = req.body;
  const cleanVisibility = ALLOWED.includes(visibility) ? visibility : 'svi';
  const cleanContact = ALLOWED.includes(contact) ? contact : 'svi';
  const showOnline = online !== 'ne';

  const fields = ['profile_visibility = $1', 'contact_restriction = $2', 'show_online_status = $3'];
  const values = [cleanVisibility, cleanContact, showOnline];
  if (browserNotifications !== undefined) {
    values.push(!!browserNotifications);
    fields.push(`browser_notifications = $${values.length}`);
  }
  values.push(req.user.userId);

  await db.query(
    `UPDATE users SET ${fields.join(', ')}, updated_at = now() WHERE id = $${values.length}`,
    values
  );
  res.json({ ok: true });
});

module.exports = router;
