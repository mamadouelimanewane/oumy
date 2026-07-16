const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');

// Generate OTP (mock - in production use SMS gateway)
router.post('/send-otp', authenticate, async (req, res) => {
  try {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 min

    await pool.query(
      `UPDATE users SET otp_code = $1, otp_expires = $2 WHERE id = $3`,
      [otp, expires, req.user.id]
    );

    // In production: send SMS via Twilio/Africa's Talking
    console.log(`OTP for user ${req.user.id}: ${otp}`);
    res.json({ success: true, message: 'OTP envoyé par SMS', expires_in: 300 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verify OTP
router.post('/verify-otp', authenticate, async (req, res) => {
  try {
    const { otp } = req.body;
    const result = await pool.query(
      'SELECT otp_code, otp_expires FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = result.rows[0];
    if (!user || user.otp_code !== otp) return res.status(400).json({ error: 'OTP invalide' });
    if (new Date() > new Date(user.otp_expires)) return res.status(400).json({ error: 'OTP expiré' });

    await pool.query('UPDATE users SET otp_code = NULL, otp_expires = NULL, two_fa_verified = true WHERE id = $1', [req.user.id]);
    res.json({ success: true, verified: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
