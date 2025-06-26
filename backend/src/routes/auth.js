const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../database/init');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Registro de usuario
router.post('/register', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    
    // Validar datos
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }
    
    // Verificar si el usuario ya existe
    const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userCheck.rows.length > 0) {
      return res.status(409).json({ error: 'El usuario ya existe' });
    }
    
    // Hash de la contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Crear usuario
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id, email, full_name, is_admin',
      [email, hashedPassword, fullName]
    );
    
    // Generar token
    const token = jwt.sign(
      { id: result.rows[0].id, email, isAdmin: result.rows[0].is_admin },
      process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this',
      { expiresIn: '24h' }
    );
    
    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user: {
        id: result.rows[0].id,
        email: result.rows[0].email,
        fullName: result.rows[0].full_name,
        isAdmin: result.rows[0].is_admin
      },
      token
    });
  } catch (error) {
    logger.error('Error en registro:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Inicio de sesión
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validar datos
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }
    
    // Buscar usuario
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    
    const user = result.rows[0];
    
    // Verificar contraseña
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    
    // Generar token
    const token = jwt.sign(
      { id: user.id, email: user.email, isAdmin: user.is_admin },
      process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this',
      { expiresIn: '24h' }
    );
    
    res.json({
      message: 'Inicio de sesión exitoso',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        isAdmin: user.is_admin
      },
      token
    });
  } catch (error) {
    logger.error('Error en inicio de sesión:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener usuario actual
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, full_name, is_admin FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    const user = result.rows[0];
    
    res.json({
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      isAdmin: user.is_admin
    });
  } catch (error) {
    logger.error('Error al obtener usuario actual:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar perfil
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { fullName } = req.body;
    
    const result = await pool.query(
      'UPDATE users SET full_name = $1 WHERE id = $2 RETURNING id, email, full_name',
      [fullName, req.user.id]
    );
    
    res.json({
      message: 'Perfil actualizado exitosamente',
      user: {
        id: result.rows[0].id,
        email: result.rows[0].email,
        fullName: result.rows[0].full_name
      }
    });
  } catch (error) {
    logger.error('Error al actualizar perfil:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Cambiar contraseña
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Validar datos
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Contraseña actual y nueva son requeridas' });
    }
    
    // Buscar usuario
    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    
    // Verificar contraseña actual
    const validPassword = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Contraseña actual incorrecta' });
    }
    
    // Hash de la nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // Actualizar contraseña
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [hashedPassword, req.user.id]
    );
    
    res.json({ message: 'Contraseña actualizada exitosamente' });
  } catch (error) {
    logger.error('Error al cambiar contraseña:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;