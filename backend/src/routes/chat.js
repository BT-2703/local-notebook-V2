const express = require('express');
const { pool } = require('../database/init');
const { authenticateToken } = require('../middleware/auth');
const { generateChatResponse } = require('../services/llmService');
const { searchDocuments } = require('../services/vectorService');
const logger = require('../utils/logger');

const router = express.Router();

// Middleware de autenticación para todas las rutas
router.use(authenticateToken);

// Obtener historial de chat para un cuaderno
router.get('/history/:notebookId', async (req, res) => {
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
    
    // Obtener mensajes
    const result = await pool.query(
      'SELECT * FROM chat_histories WHERE session_id = $1 ORDER BY id ASC',
      [notebookId]
    );
    
    res.json(result.rows);
  } catch (error) {
    logger.error('Error al obtener historial de chat:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Enviar mensaje al chat
router.post('/send/:notebookId', async (req, res) => {
  try {
    const { notebookId } = req.params;
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'El mensaje es requerido' });
    }
    
    // Verificar propiedad del cuaderno
    const notebookCheck = await pool.query(
      'SELECT id FROM notebooks WHERE id = $1 AND user_id = $2',
      [notebookId, req.user.id]
    );
    
    if (notebookCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Cuaderno no encontrado' });
    }
    
    // Verificar si hay fuentes procesadas
    const sourcesCheck = await pool.query(
      'SELECT COUNT(*) FROM sources WHERE notebook_id = $1 AND processing_status = $2',
      [notebookId, 'completed']
    );
    
    if (parseInt(sourcesCheck.rows[0].count) === 0) {
      return res.status(400).json({ error: 'No hay fuentes procesadas en este cuaderno' });
    }
    
    // Guardar mensaje del usuario
    const userMessageResult = await pool.query(
      'INSERT INTO chat_histories (session_id, message) VALUES ($1, $2) RETURNING *',
      [notebookId, { type: 'human', content: message }]
    );
    
    // Buscar documentos relevantes
    const relevantDocs = await searchDocuments(message, notebookId);
    
    // Obtener historial de chat reciente (últimos 10 mensajes)
    const historyResult = await pool.query(
      'SELECT message FROM chat_histories WHERE session_id = $1 ORDER BY id DESC LIMIT 10',
      [notebookId]
    );
    
    const chatHistory = historyResult.rows.map(row => row.message).reverse();
    
    // Construir prompt con contexto
    const context = relevantDocs.map(doc => doc.content).join('\n\n');
    
    const systemMessage = {
      role: 'system',
      content: `Eres un asistente de investigación útil y preciso. Responde a las preguntas basándote ÚNICAMENTE en la información proporcionada en el contexto. Si la información no está en el contexto, di "Lo siento, no tengo información sobre eso en mis fuentes." No inventes información.

Contexto:
${context}`
    };
    
    // Generar respuesta
    const aiResponse = await generateChatResponse([systemMessage, ...chatHistory, { role: 'user', content: message }]);
    
    // Procesar respuesta para incluir citas
    const processedResponse = processResponseWithCitations(aiResponse.text, relevantDocs);
    
    // Guardar respuesta del asistente
    const assistantMessageResult = await pool.query(
      'INSERT INTO chat_histories (session_id, message) VALUES ($1, $2) RETURNING *',
      [notebookId, { 
        type: 'ai', 
        content: JSON.stringify(processedResponse),
        provider: aiResponse.provider,
        model: aiResponse.model
      }]
    );
    
    res.json({
      userMessage: userMessageResult.rows[0],
      aiMessage: assistantMessageResult.rows[0]
    });
  } catch (error) {
    logger.error('Error al enviar mensaje:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Borrar historial de chat
router.delete('/history/:notebookId', async (req, res) => {
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
    
    // Eliminar mensajes
    await pool.query(
      'DELETE FROM chat_histories WHERE session_id = $1',
      [notebookId]
    );
    
    res.json({ message: 'Historial de chat eliminado exitosamente' });
  } catch (error) {
    logger.error('Error al eliminar historial de chat:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Función para procesar respuesta y añadir citas
function processResponseWithCitations(text, relevantDocs) {
  // Dividir la respuesta en segmentos
  const segments = [];
  const citations = [];
  
  // Simplemente dividimos por párrafos para este ejemplo
  // En una implementación real, se usaría un algoritmo más sofisticado
  const paragraphs = text.split('\n\n').filter(p => p.trim());
  
  paragraphs.forEach((paragraph, index) => {
    // Encontrar la fuente más relevante para este párrafo
    const mostRelevantDoc = relevantDocs[index % relevantDocs.length];
    
    if (mostRelevantDoc) {
      const citationId = index + 1;
      
      segments.push({
        text: paragraph,
        citation_id: citationId
      });
      
      citations.push({
        citation_id: citationId,
        source_id: mostRelevantDoc.metadata.source_id,
        source_title: mostRelevantDoc.metadata.source_title || 'Fuente desconocida',
        source_type: mostRelevantDoc.metadata.source_type || 'text',
        chunk_index: mostRelevantDoc.id,
        chunk_lines_from: 1,
        chunk_lines_to: paragraph.split('\n').length,
        excerpt: mostRelevantDoc.content.substring(0, 200) + '...'
      });
    } else {
      segments.push({
        text: paragraph
      });
    }
  });
  
  return {
    segments,
    citations
  };
}

module.exports = router;