const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const ffmpeg = require('fluent-ffmpeg');
const { pool } = require('../database/init');
const { authenticateToken } = require('../middleware/auth');
const { generateChatResponse } = require('../services/llmService');
const logger = require('../utils/logger');

const router = express.Router();

// Middleware de autenticación para todas las rutas
router.use(authenticateToken);

// Generar audio para un cuaderno
router.post('/generate/:notebookId', async (req, res) => {
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
    
    // Actualizar estado
    await pool.query(
      'UPDATE notebooks SET audio_overview_generation_status = $1 WHERE id = $2',
      ['generating', notebookId]
    );
    
    // Iniciar generación en segundo plano
    generateAudioOverview(notebookId)
      .catch(error => logger.error('Error en generación de audio:', error));
    
    res.json({ message: 'Generación de audio iniciada' });
  } catch (error) {
    logger.error('Error al iniciar generación de audio:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener URL de audio
router.get('/:notebookId', async (req, res) => {
  try {
    const { notebookId } = req.params;
    
    // Verificar propiedad del cuaderno
    const result = await pool.query(
      'SELECT audio_overview_url, audio_overview_generation_status, audio_url_expires_at FROM notebooks WHERE id = $1 AND user_id = $2',
      [notebookId, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cuaderno no encontrado' });
    }
    
    const notebook = result.rows[0];
    
    // Verificar si la URL ha expirado
    if (notebook.audio_url_expires_at && new Date(notebook.audio_url_expires_at) < new Date()) {
      return res.status(410).json({ 
        error: 'URL de audio expirada',
        status: notebook.audio_overview_generation_status
      });
    }
    
    res.json({
      url: notebook.audio_overview_url,
      status: notebook.audio_overview_generation_status,
      expiresAt: notebook.audio_url_expires_at
    });
  } catch (error) {
    logger.error('Error al obtener URL de audio:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Refrescar URL de audio
router.post('/refresh/:notebookId', async (req, res) => {
  try {
    const { notebookId } = req.params;
    
    // Verificar propiedad del cuaderno
    const notebookCheck = await pool.query(
      'SELECT id, audio_overview_url FROM notebooks WHERE id = $1 AND user_id = $2',
      [notebookId, req.user.id]
    );
    
    if (notebookCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Cuaderno no encontrado' });
    }
    
    const notebook = notebookCheck.rows[0];
    
    if (!notebook.audio_overview_url) {
      return res.status(404).json({ error: 'No hay audio disponible para este cuaderno' });
    }
    
    // Extraer nombre de archivo de la URL
    const urlParts = notebook.audio_overview_url.split('/');
    const filename = urlParts[urlParts.length - 1];
    
    // Calcular nueva fecha de expiración (24 horas)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    // Actualizar URL y fecha de expiración
    await pool.query(
      'UPDATE notebooks SET audio_url_expires_at = $1 WHERE id = $2',
      [expiresAt, notebookId]
    );
    
    res.json({
      url: notebook.audio_overview_url,
      expiresAt
    });
  } catch (error) {
    logger.error('Error al refrescar URL de audio:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Eliminar audio
router.delete('/:notebookId', async (req, res) => {
  try {
    const { notebookId } = req.params;
    
    // Verificar propiedad del cuaderno
    const notebookCheck = await pool.query(
      'SELECT id, audio_overview_url FROM notebooks WHERE id = $1 AND user_id = $2',
      [notebookId, req.user.id]
    );
    
    if (notebookCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Cuaderno no encontrado' });
    }
    
    const notebook = notebookCheck.rows[0];
    
    // Eliminar archivo si existe
    if (notebook.audio_overview_url) {
      const urlParts = notebook.audio_overview_url.split('/');
      const filename = urlParts[urlParts.length - 1];
      const filePath = path.join('audio', filename);
      
      try {
        await fs.access(filePath);
        await fs.unlink(filePath);
      } catch (err) {
        logger.warn(`Archivo de audio no encontrado o no se pudo eliminar: ${filePath}`);
      }
    }
    
    // Actualizar cuaderno
    await pool.query(
      'UPDATE notebooks SET audio_overview_url = NULL, audio_url_expires_at = NULL, audio_overview_generation_status = NULL WHERE id = $1',
      [notebookId]
    );
    
    res.json({ message: 'Audio eliminado exitosamente' });
  } catch (error) {
    logger.error('Error al eliminar audio:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Función para generar audio
async function generateAudioOverview(notebookId) {
  try {
    // Obtener fuentes del cuaderno
    const sourcesResult = await pool.query(
      'SELECT content, summary FROM sources WHERE notebook_id = $1 AND processing_status = $2',
      [notebookId, 'completed']
    );
    
    if (sourcesResult.rows.length === 0) {
      await pool.query(
        'UPDATE notebooks SET audio_overview_generation_status = $1 WHERE id = $2',
        ['failed', notebookId]
      );
      return;
    }
    
    // Extraer contenido de las fuentes
    const sourceContent = sourcesResult.rows
      .map(source => source.summary || source.content?.substring(0, 1000))
      .filter(Boolean)
      .join('\n\n');
    
    // Generar script de podcast
    const systemPrompt = {
      role: 'system',
      content: `Eres un experto en crear guiones de podcast. Crea un guión para un podcast de estilo conversacional entre dos hosts (Locutor 1 y Locutor 2) que discuten el tema proporcionado. El guión debe:

1. Comenzar con una introducción interesante
2. Alternar entre los dos locutores
3. Usar un tono conversacional y accesible
4. Incluir preguntas retóricas y transiciones naturales
5. Terminar con una conclusión que resuma los puntos clave

Formato exacto requerido:
Locutor 1: [texto]
Locutor 2: [texto]
...

El guión debe tener entre 5-7 minutos de duración (aproximadamente 750-1000 palabras).`
    };
    
    const userPrompt = {
      role: 'user',
      content: sourceContent
    };
    
    const response = await generateChatResponse([systemPrompt, userPrompt]);
    const script = response.text;
    
    // Generar archivo de audio (simulado para este ejemplo)
    const audioFilename = `${uuidv4()}.mp3`;
    const audioPath = path.join('audio', audioFilename);
    
    // En una implementación real, aquí se generaría el audio con un servicio TTS
    // Para este ejemplo, creamos un archivo de audio vacío
    await fs.writeFile(audioPath, '');
    
    // Calcular fecha de expiración (24 horas)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    // Actualizar cuaderno
    await pool.query(
      `UPDATE notebooks 
       SET audio_overview_url = $1, 
           audio_url_expires_at = $2, 
           audio_overview_generation_status = $3
       WHERE id = $4`,
      [
        `/audio/${audioFilename}`,
        expiresAt,
        'completed',
        notebookId
      ]
    );
    
    logger.info(`Generación de audio completada para: ${notebookId}`);
  } catch (error) {
    logger.error('Error en generación de audio:', error);
    
    // Actualizar estado a fallido
    await pool.query(
      'UPDATE notebooks SET audio_overview_generation_status = $1 WHERE id = $2',
      ['failed', notebookId]
    );
  }
}

module.exports = router;