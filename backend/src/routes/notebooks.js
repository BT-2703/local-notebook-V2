const express = require('express');
const { pool } = require('../database/init');
const { authenticateToken } = require('../middleware/auth');
const { deleteDocumentsByNotebookId } = require('../services/vectorService');
const logger = require('../utils/logger');

const router = express.Router();

// Middleware de autenticación para todas las rutas
router.use(authenticateToken);

// Obtener todos los cuadernos del usuario
router.get('/', async (req, res) => {
  try {
    // Obtener cuadernos
    const notebooksResult = await pool.query(
      'SELECT * FROM notebooks WHERE user_id = $1 ORDER BY updated_at DESC',
      [req.user.id]
    );
    
    // Para cada cuaderno, obtener el conteo de fuentes
    const notebooksWithCounts = await Promise.all(
      notebooksResult.rows.map(async (notebook) => {
        const countResult = await pool.query(
          'SELECT COUNT(*) FROM sources WHERE notebook_id = $1',
          [notebook.id]
        );
        
        return {
          ...notebook,
          sources: [{ count: parseInt(countResult.rows[0].count) }]
        };
      })
    );
    
    res.json(notebooksWithCounts);
  } catch (error) {
    logger.error('Error al obtener cuadernos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener un cuaderno específico
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM notebooks WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cuaderno no encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error al obtener cuaderno:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Crear un nuevo cuaderno
router.post('/', async (req, res) => {
  try {
    const { title, description } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'El título es requerido' });
    }
    
    const result = await pool.query(
      'INSERT INTO notebooks (user_id, title, description, generation_status) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.user.id, title, description, 'pending']
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Error al crear cuaderno:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar un cuaderno
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, icon, color } = req.body;
    
    // Verificar propiedad
    const checkResult = await pool.query(
      'SELECT id FROM notebooks WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Cuaderno no encontrado' });
    }
    
    // Construir consulta dinámica
    let query = 'UPDATE notebooks SET ';
    const values = [];
    const updateFields = [];
    
    if (title !== undefined) {
      values.push(title);
      updateFields.push(`title = $${values.length}`);
    }
    
    if (description !== undefined) {
      values.push(description);
      updateFields.push(`description = $${values.length}`);
    }
    
    if (icon !== undefined) {
      values.push(icon);
      updateFields.push(`icon = $${values.length}`);
    }
    
    if (color !== undefined) {
      values.push(color);
      updateFields.push(`color = $${values.length}`);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron campos para actualizar' });
    }
    
    query += updateFields.join(', ');
    values.push(id);
    query += ` WHERE id = $${values.length} RETURNING *`;
    
    const result = await pool.query(query, values);
    
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error al actualizar cuaderno:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Eliminar un cuaderno
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar propiedad
    const checkResult = await pool.query(
      'SELECT id FROM notebooks WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Cuaderno no encontrado' });
    }
    
    // Eliminar documentos vectoriales asociados
    await deleteDocumentsByNotebookId(id);
    
    // Eliminar cuaderno (las fuentes, notas y chat se eliminarán en cascada)
    await pool.query('DELETE FROM notebooks WHERE id = $1', [id]);
    
    res.json({ message: 'Cuaderno eliminado exitosamente' });
  } catch (error) {
    logger.error('Error al eliminar cuaderno:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Generar contenido del cuaderno
router.post('/:id/generate', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar propiedad
    const checkResult = await pool.query(
      'SELECT id FROM notebooks WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Cuaderno no encontrado' });
    }
    
    // Actualizar estado
    await pool.query(
      'UPDATE notebooks SET generation_status = $1 WHERE id = $2',
      ['generating', id]
    );
    
    // Iniciar generación en segundo plano
    generateNotebookContent(id)
      .catch(error => logger.error('Error en generación de cuaderno:', error));
    
    res.json({ message: 'Generación de contenido iniciada' });
  } catch (error) {
    logger.error('Error al iniciar generación de cuaderno:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Función para generar contenido del cuaderno
async function generateNotebookContent(notebookId) {
  try {
    // Obtener fuentes del cuaderno
    const sourcesResult = await pool.query(
      'SELECT content, summary FROM sources WHERE notebook_id = $1 AND processing_status = $2 LIMIT 5',
      [notebookId, 'completed']
    );
    
    if (sourcesResult.rows.length === 0) {
      await pool.query(
        'UPDATE notebooks SET generation_status = $1 WHERE id = $2',
        ['failed', notebookId]
      );
      return;
    }
    
    // Extraer contenido de las fuentes
    const sourceContent = sourcesResult.rows
      .map(source => source.summary || source.content?.substring(0, 1000))
      .filter(Boolean)
      .join('\n\n');
    
    // Generar título y descripción usando LLM
    const { generateChatResponse } = require('./llmService');
    
    const systemPrompt = {
      role: 'system',
      content: `Basado en el contenido proporcionado, genera un título apropiado y un resumen del documento. 
      También proporciona un emoji UTF-8 adecuado para el cuaderno y un color de la siguiente lista:
      slate, gray, zinc, neutral, stone, red, orange, amber, yellow, lime, green, emerald, teal, cyan, sky, blue, indigo, violet, purple, fuchsia, pink, rose.
      
      También genera una lista de 5 preguntas de ejemplo que podrían hacerse sobre este documento. Máximo 10 palabras cada una.
      
      Devuelve solo en formato JSON.`
    };
    
    const userPrompt = {
      role: 'user',
      content: sourceContent
    };
    
    const response = await generateChatResponse([systemPrompt, userPrompt]);
    
    // Parsear respuesta JSON
    const jsonMatch = response.text.match(/```json\n([\s\S]*)\n```/) || 
                      response.text.match(/\{[\s\S]*\}/);
    
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(jsonMatch ? jsonMatch[1] || jsonMatch[0] : response.text);
    } catch (error) {
      logger.error('Error al parsear respuesta JSON:', error);
      parsedResponse = {
        title: 'Cuaderno sin título',
        summary: 'No se pudo generar un resumen.',
        notebook_icon: '📝',
        background_color: 'gray',
        example_questions: []
      };
    }
    
    // Actualizar cuaderno
    await pool.query(
      `UPDATE notebooks 
       SET title = $1, description = $2, icon = $3, color = $4, 
           example_questions = $5, generation_status = $6
       WHERE id = $7`,
      [
        parsedResponse.title || 'Cuaderno sin título',
        parsedResponse.summary || 'No se pudo generar un resumen.',
        parsedResponse.notebook_icon || '📝',
        parsedResponse.background_color || 'gray',
        parsedResponse.example_questions || [],
        'completed',
        notebookId
      ]
    );
    
    logger.info(`Generación de cuaderno completada para: ${notebookId}`);
  } catch (error) {
    logger.error('Error en generación de cuaderno:', error);
    
    // Actualizar estado a fallido
    await pool.query(
      'UPDATE notebooks SET generation_status = $1 WHERE id = $2',
      ['failed', notebookId]
    );
  }
}

module.exports = router;