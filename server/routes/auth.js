/**
 * routes/auth.js — Authentification JWT simple pour l'Amiral
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'passerelle-secret-change-me-in-prod';
const PASSWORD_HASH = process.env.AMIRAL_PASSWORD_HASH || bcrypt.hashSync('amiral', 10);

/**
 * POST /api/auth/login
 * Connexion de l'Amiral
 */
router.post('/login', async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'Mot de passe requis' });
    }
    
    const valid = await bcrypt.compare(password, PASSWORD_HASH);
    
    if (!valid) {
      return res.status(401).json({ error: 'Mot de passe incorrect' });
    }
    
    // Générer le token JWT (expire dans 7 jours)
    const token = jwt.sign(
      { role: 'amiral', iat: Date.now() },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Stocker en cookie httpOnly
    res.cookie('passerelle_token', token, {
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 jours
    });
    
    res.json({ ok: true, message: 'Bienvenue, Amiral ⚡' });
  } catch (err) {
    console.error('❌ POST /auth/login:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/auth/logout
 * Déconnexion
 */
router.post('/logout', (req, res) => {
  res.clearCookie('passerelle_token');
  res.json({ ok: true, message: 'À bientôt, Amiral' });
});

/**
 * GET /api/auth/status
 * Vérifier si l'Amiral est connecté
 */
router.get('/status', (req, res) => {
  const token = req.cookies?.passerelle_token;
  
  if (!token) {
    return res.json({ authenticated: false });
  }
  
  try {
    jwt.verify(token, JWT_SECRET);
    res.json({ authenticated: true });
  } catch {
    res.json({ authenticated: false });
  }
});

/**
 * Middleware d'authentification (exporté pour les autres routes)
 */
function requireAuth(req, res, next) {
  const token = req.cookies?.passerelle_token;
  
  if (!token) {
    return res.status(401).json({ error: 'Non authentifié — connexion requise' });
  }
  
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

module.exports = router;
module.exports.requireAuth = requireAuth;
