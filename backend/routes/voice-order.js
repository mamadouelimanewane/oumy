const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');

// Process voice command text and return matching items
router.post('/search', authenticate, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text requis' });

    // Simple keyword extraction and search
    const keywords = text.toLowerCase()
      .replace(/je veux|j'aimerais|donne moi|commande|livré|chez moi|s'il vous plaît|svp/gi, '')
      .trim()
      .split(/\s+/)
      .filter(w => w.length > 2);

    if (keywords.length === 0) return res.json({ items: [], message: 'Aucun plat trouvé' });

    const conditions = keywords.map((_, i) => `(LOWER(name) LIKE $${i + 1} OR LOWER(description) LIKE $${i + 1})`).join(' OR ');
    const params = keywords.map(k => `%${k}%`);

    const result = await pool.query(
      `SELECT * FROM menu_items WHERE available = true AND (${conditions}) ORDER BY name LIMIT 10`,
      params
    );
    res.json({ items: result.rows, query: text, keywords });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
