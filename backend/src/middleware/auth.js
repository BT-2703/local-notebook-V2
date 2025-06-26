const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

// Middleware para verificar token JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });
  }
  
  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this');
    req.user = verified;
    next();
  } catch (error) {
    logger.error('Error de autenticación:', error);
    return res.status(403).json({ error: 'Token inválido o expirado' });
  }
}

// Middleware para verificar permisos de administrador
function requireAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de administrador.' });
  }
  next();
}

module.exports = { authenticateToken, requireAdmin };