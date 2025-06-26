const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../database/init');
const { authenticateToken } = require('../middleware/auth');
const { processDocument } = require('../services/documentProcessor');
const { deleteDocumentsBySourceId } = require('../services/vectorService');
const logger = require('../utils/logger');

const router = express.Router();

// Configuración de multer para subida de archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'audio/mpeg',
      'audio/wav',
      'audio/mp4'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no soportado'));
    }
  }
});

// Middleware de autenticación para todas las rutas
router.use(authenticateToken);

// Obtener todas las fuentes de un cuaderno
router.get('/notebook/:notebookId', async (req, res) => {
  try {
    const { notebookId } = req.params;
    
    // Verificar propiedad del cuaderno
    const notebookCheck = await pool.query(
      'SELECT id FROM notebooks WHERE id = $1 AND user_id = $2',
      [notebookId, req.user.id]
    );
    
    if (notebookCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Cuaderno no encontrado' });
    }
    
    // Obtener fuentes
    const result = await pool.query(
      'SELECT * FROM sources WHERE notebook_id = $1 ORDER BY created_at DESC',
      [notebookId]
    );
    
    res.json(result.rows);
  } catch (error) {
    logger.error('Error al obtener fuentes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener una fuente específica
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT s.* 
      FROM sources s
      JOIN notebooks n ON s.notebook_id = n.id
      WHERE s.id = $1 AND n.user_id = $2
    `, [id, req.user.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Fuente no encontrada' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error al obtener fuente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Subir archivo como fuente
router.post('/upload/:notebookId', upload.single('file'), async (req, res) => {
  try {
    const { notebookId } = req.params;
    const { title } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
    }
    
    // Verificar propiedad del cuaderno
    const notebookCheck = await pool.query(
      'SELECT id FROM notebooks WHERE id = $1 AND user_id = $2',
      [notebookId, req.user.id]
    );
    
    if (notebookCheck.rows.length === 0) {
      // Eliminar archivo subido
      await fs.unlink(req.file.path);
      return res.status(404).json({ error: 'Cuaderno no encontrado' });
    }
    
    // Determinar tipo de fuente
    let sourceType;
    if (req.file.mimetype.includes('pdf')) {
      sourceType = 'pdf';
    } else if (req.file.mimetype.includes('audio')) {
      sourceType = 'audio';
    } else {
      sourceType = 'text';
    }
    
    // Crear registro de fuente
    const result = await pool.query(`
      INSERT INTO sources (
        notebook_id, title, type, file_path, file_size, 
        processing_status, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      notebookId,
      title || req.file.originalname,
      sourceType,
      req.file.path,
      req.file.size,
      'processing',
      {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype
      }
    ]);
    
    const source = result.rows[0];
    
    // Iniciar procesamiento en segundo plano
    processDocument(source.id)
      .catch(error => logger.error('Error en procesamiento de documento:', error));
    
    res.status(201).json(source);
  } catch (error) {
    logger.error('Error al subir fuente:', error);
    
    // Eliminar archivo si existe
    if (req.file) {
      await fs.unlink(req.file.path).catch(err => {
        logger.error('Error al eliminar archivo:', err);
      });
    }
    
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Añadir texto como fuente
router.post('/text/:notebookId', async (req, res) => {
  try {
    const { notebookId } = req.params;
    const { title, content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'El contenido es requerido' });
    }
    
    // Verificar propiedad del cuaderno
    const notebookCheck = await pool.query(
      'SELECT id FROM notebooks WHERE id = $1 AND user_id = $2',
      [notebookId, req.user.id]
    );
    
    if (notebookCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Cuaderno no encontrado' });
    }
    
    // Crear registro de fuente
    const result = await pool.query(`
      INSERT INTO sources (
        notebook_id, title, type, content, 
        processing_status, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      notebookId,
      title || 'Texto sin título',
      'text',
      content,
      'processing',
      {
        characterCount: content.length,
        dateAdded: new Date().toISOString()
      }
    ]);
    
    const source = result.rows[0];
    
    // Iniciar procesamiento en segundo plano
    processDocument(source.id)
      .catch(error => logger.error('Error en procesamiento de documento:', error));
    
    res.status(201).json(source);
  } catch (error) {
    logger.error('Error al añadir texto:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Añadir URL como fuente
router.post('/url/:notebookId', async (req, res) => {
  try {
    const { notebookId } = req.params;
    const { url, title, type = 'website' } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'La URL es requerida' });
    }
    
    // Verificar propiedad del cuaderno
    const notebookCheck = await pool.query(
      'SELECT id FROM notebooks WHERE id = $1 AND user_id = $2',
      [notebookId, req.user.id]
    );
    
    if (notebookCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Cuaderno no encontrado' });
    }
    
    // Validar tipo
    if (!['website', 'youtube'].includes(type)) {
      return res.status(400).json({ error: 'Tipo de URL no válido' });
    }
    
    // Crear registro de fuente
    const result = await pool.query(`
      INSERT INTO sources (
        notebook_id, title, type, url, 
        processing_status, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      notebookId,
      title || url,
      type,
      url,
      'processing',
      {
        originalUrl: url,
        dateAdded: new Date().toISOString()
      }
    ]);
    
    const source = result.rows[0];
    
    // Iniciar procesamiento en segundo plano
    processDocument(source.id)
      .catch(error => logger.error('Error en procesamiento de documento:', error));
    
    res.status(201).json(source);
  } catch (error) {
    logger.error('Error al añadir URL:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar una fuente
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;
    
    // Verificar propiedad
    const sourceCheck = await pool.query(`
      SELECT s.id 
      FROM sources s
      JOIN notebooks n ON s.notebook_id = n.id
      WHERE s.id = $1 AND n.user_id = $2
    `, [id, req.user.id]);
    
    if (sourceCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Fuente no encontrada' });
    }
    
    // Actualizar fuente
    const result = await pool.query(
      'UPDATE sources SET title = $1 WHERE id = $2 RETURNING *',
      [title, id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error al actualizar fuente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Eliminar una fuente
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar propiedad y obtener información de la fuente
    const sourceCheck = await pool.query(`
      SELECT s.* 
      FROM sources s
      JOIN notebooks n ON s.notebook_id = n.id
      WHERE s.id = $1 AND n.user_id = $2
    `, [id, req.user.id]);
    
    if (sourceCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Fuente no encontrada' });
    }
    
    const source = sourceCheck.rows[0];
    
    // Eliminar archivo si existe
    if (source.file_path) {
      try {
        await fs.access(source.file_path);
        await fs.unlink(source.file_path);
      } catch (err) {
        logger.warn(`Archivo no encontrado o no se pudo eliminar: ${source.file_path}`);
      }
    }
    
    // Eliminar documentos vectoriales asociados
    await deleteDocumentsBySourceId(id);
    
    // Eliminar fuente
    await pool.query('DELETE FROM sources WHERE id = $1', [id]);
    
    res.json({ message: 'Fuente eliminada exitosamente' });
  } catch (error) {
    logger.error('Error al eliminar fuente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;