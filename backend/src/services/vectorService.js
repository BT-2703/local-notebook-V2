const { pool } = require('../database/init');
const { generateEmbeddings } = require('./llmService');
const logger = require('../utils/logger');

// Función para insertar documento en la base de datos vectorial
async function insertDocument(content, metadata) {
  try {
    // Generar embedding para el contenido
    const embedding = await generateEmbeddings(content);
    
    // Insertar en la base de datos
    const result = await pool.query(
      'INSERT INTO documents (content, metadata, embedding) VALUES ($1, $2, $3) RETURNING id',
      [content, metadata, embedding]
    );
    
    return result.rows[0].id;
  } catch (error) {
    logger.error('Error al insertar documento:', error);
    throw error;
  }
}

// Función para buscar documentos similares
async function searchDocuments(query, notebookId, limit = 5) {
  try {
    // Generar embedding para la consulta
    const embedding = await generateEmbeddings(query);
    
    // Buscar documentos similares
    const result = await pool.query(`
      SELECT 
        id, 
        content, 
        metadata, 
        1 - (embedding <=> $1) as similarity
      FROM 
        documents
      WHERE 
        metadata->>'notebook_id' = $2
      ORDER BY 
        embedding <=> $1
      LIMIT $3
    `, [embedding, notebookId, limit]);
    
    return result.rows;
  } catch (error) {
    logger.error('Error al buscar documentos:', error);
    throw error;
  }
}

// Función para eliminar documentos por notebook_id
async function deleteDocumentsByNotebookId(notebookId) {
  try {
    await pool.query(
      "DELETE FROM documents WHERE metadata->>'notebook_id' = $1",
      [notebookId]
    );
    
    logger.info(`Documentos eliminados para el cuaderno ${notebookId}`);
  } catch (error) {
    logger.error('Error al eliminar documentos:', error);
    throw error;
  }
}

// Función para eliminar documentos por source_id
async function deleteDocumentsBySourceId(sourceId) {
  try {
    await pool.query(
      "DELETE FROM documents WHERE metadata->>'source_id' = $1",
      [sourceId]
    );
    
    logger.info(`Documentos eliminados para la fuente ${sourceId}`);
  } catch (error) {
    logger.error('Error al eliminar documentos:', error);
    throw error;
  }
}

module.exports = {
  insertDocument,
  searchDocuments,
  deleteDocumentsByNotebookId,
  deleteDocumentsBySourceId
};