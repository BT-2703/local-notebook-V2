const express = require('express');
const { pool } = require('../database/init');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Middleware para rutas de administrador
router.use(authenticateToken);
router.use(requireAdmin);

// Obtener todas las configuraciones de LLM
router.get('/llm-configs', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, provider, model, base_url, is_active, is_default, config, created_at, updated_at
      FROM llm_configs 
      ORDER BY is_default DESC, name ASC
    `);
    
    res.json(result.rows);
  } catch (error) {
    logger.error('Error al obtener configuraciones LLM:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Crear nueva configuración de LLM
router.post('/llm-configs', async (req, res) => {
  try {
    const { name, provider, model, api_key, base_url, is_active, is_default, config } = req.body;
    
    // Si se marca como predeterminado, desmarcar otros
    if (is_default) {
      await pool.query('UPDATE llm_configs SET is_default = false');
    }
    
    const result = await pool.query(`
      INSERT INTO llm_configs (name, provider, model, api_key, base_url, is_active, is_default, config)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, name, provider, model, base_url, is_active, is_default, config, created_at, updated_at
    `, [name, provider, model, api_key, base_url, is_active, is_default, config || {}]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Error al crear configuración LLM:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar configuración de LLM
router.put('/llm-configs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, provider, model, api_key, base_url, is_active, is_default, config } = req.body;
    
    // Si se marca como predeterminado, desmarcar otros
    if (is_default) {
      await pool.query('UPDATE llm_configs SET is_default = false WHERE id != $1', [id]);
    }
    
    const result = await pool.query(`
      UPDATE llm_configs 
      SET name = $1, provider = $2, model = $3, api_key = $4, base_url = $5, 
          is_active = $6, is_default = $7, config = $8
      WHERE id = $9
      RETURNING id, name, provider, model, base_url, is_active, is_default, config, created_at, updated_at
    `, [name, provider, model, api_key, base_url, is_active, is_default, config || {}, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Configuración no encontrada' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error al actualizar configuración LLM:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Eliminar configuración de LLM
router.delete('/llm-configs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar si es la configuración predeterminada
    const checkResult = await pool.query('SELECT is_default FROM llm_configs WHERE id = $1', [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Configuración no encontrada' });
    }
    
    if (checkResult.rows[0].is_default) {
      return res.status(400).json({ error: 'No se puede eliminar la configuración predeterminada' });
    }
    
    await pool.query('DELETE FROM llm_configs WHERE id = $1', [id]);
    
    res.status(204).send();
  } catch (error) {
    logger.error('Error al eliminar configuración LLM:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener modelos disponibles de Ollama
router.get('/ollama-models', async (req, res) => {
  try {
    const { default: ollama } = await import('ollama');
    
    // Configurar URL base de Ollama
    const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    ollama.setBaseUrl(ollamaBaseUrl);
    
    const models = await ollama.list();
    
    res.json(models.models || []);
  } catch (error) {
    logger.error('Error al obtener modelos de Ollama:', error);
    res.status(500).json({ 
      error: 'Error al conectar con Ollama',
      message: error.message,
      tip: 'Verifica que Ollama esté ejecutándose y sea accesible'
    });
  }
});

// Obtener estadísticas del sistema
router.get('/stats', async (req, res) => {
  try {
    const stats = {};
    
    // Total de usuarios
    const usersResult = await pool.query('SELECT COUNT(*) FROM users');
    stats.totalUsers = parseInt(usersResult.rows[0].count);
    
    // Total de cuadernos
    const notebooksResult = await pool.query('SELECT COUNT(*) FROM notebooks');
    stats.totalNotebooks = parseInt(notebooksResult.rows[0].count);
    
    // Total de fuentes
    const sourcesResult = await pool.query('SELECT COUNT(*) FROM sources');
    stats.totalSources = parseInt(sourcesResult.rows[0].count);
    
    // Total de documentos en vector store
    const documentsResult = await pool.query('SELECT COUNT(*) FROM documents');
    stats.totalDocuments = parseInt(documentsResult.rows[0].count);
    
    // Distribución de tipos de fuentes
    const sourceTypesResult = await pool.query(`
      SELECT type, COUNT(*) 
      FROM sources 
      GROUP BY type
    `);
    stats.sourceTypes = sourceTypesResult.rows;
    
    // Usuarios más activos (por número de cuadernos)
    const activeUsersResult = await pool.query(`
      SELECT u.id, u.email, u.full_name, COUNT(n.id) as notebook_count
      FROM users u
      JOIN notebooks n ON u.id = n.user_id
      GROUP BY u.id, u.email, u.full_name
      ORDER BY notebook_count DESC
      LIMIT 5
    `);
    stats.activeUsers = activeUsersResult.rows;
    
    res.json(stats);
  } catch (error) {
    logger.error('Error al obtener estadísticas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Gestión de usuarios (solo listar)
router.get('/users', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, email, full_name, is_admin, created_at, updated_at
      FROM users
      ORDER BY created_at DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    logger.error('Error al obtener usuarios:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;