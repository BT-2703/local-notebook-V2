const fs = require('fs').promises;
const path = require('path');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const axios = require('axios');
const { parse } = require('node-html-parser');
const { pool } = require('../database/init');
const { insertDocument } = require('./vectorService');
const logger = require('../utils/logger');

// Función principal para procesar documento
async function processDocument(sourceId) {
  try {
    // Obtener información de la fuente
    const sourceResult = await pool.query('SELECT * FROM sources WHERE id = $1', [sourceId]);
    
    if (sourceResult.rows.length === 0) {
      throw new Error(`Fuente no encontrada: ${sourceId}`);
    }
    
    const source = sourceResult.rows[0];
    
    // Obtener información del cuaderno
    const notebookResult = await pool.query('SELECT title FROM notebooks WHERE id = $1', [source.notebook_id]);
    const notebookTitle = notebookResult.rows[0]?.title || 'Cuaderno sin título';
    
    // Extraer texto según el tipo de fuente
    let extractedText = '';
    let summary = '';
    
    switch (source.type) {
      case 'pdf':
        extractedText = await extractTextFromPDF(source.file_path);
        break;
      case 'text':
        extractedText = source.content || await extractTextFromFile(source.file_path);
        break;
      case 'website':
        extractedText = await extractTextFromWebsite(source.url);
        break;
      case 'youtube':
        extractedText = await extractTextFromYouTube(source.url);
        break;
      case 'audio':
        extractedText = await transcribeAudio(source.file_path);
        break;
      default:
        throw new Error(`Tipo de fuente no soportado: ${source.type}`);
    }
    
    // Generar resumen
    summary = await generateSummary(extractedText);
    
    // Actualizar fuente con texto extraído y resumen
    await pool.query(
      'UPDATE sources SET content = $1, summary = $2, processing_status = $3 WHERE id = $4',
      [extractedText, summary, 'completed', sourceId]
    );
    
    // Dividir texto en chunks para vectorización
    const chunks = splitTextIntoChunks(extractedText);
    
    // Insertar chunks en la base de datos vectorial
    for (const [index, chunk] of chunks.entries()) {
      await insertDocument(chunk, {
        notebook_id: source.notebook_id,
        source_id: sourceId,
        source_title: source.title,
        source_type: source.type,
        chunk_index: index,
        notebook_title: notebookTitle
      });
    }
    
    logger.info(`Documento procesado exitosamente: ${sourceId}`);
  } catch (error) {
    logger.error(`Error al procesar documento ${sourceId}:`, error);
    
    // Actualizar estado a fallido
    await pool.query(
      'UPDATE sources SET processing_status = $1 WHERE id = $2',
      ['failed', sourceId]
    );
  }
}

// Función para extraer texto de PDF
async function extractTextFromPDF(filePath) {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdf(dataBuffer);
    return data.text;
  } catch (error) {
    logger.error('Error al extraer texto de PDF:', error);
    throw error;
  }
}

// Función para extraer texto de archivo de texto
async function extractTextFromFile(filePath) {
  try {
    const extension = path.extname(filePath).toLowerCase();
    
    if (extension === '.docx') {
      const buffer = await fs.readFile(filePath);
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } else {
      // Asumir archivo de texto plano
      return await fs.readFile(filePath, 'utf8');
    }
  } catch (error) {
    logger.error('Error al extraer texto de archivo:', error);
    throw error;
  }
}

// Función para extraer texto de sitio web
async function extractTextFromWebsite(url) {
  try {
    const response = await axios.get(url);
    const root = parse(response.data);
    
    // Eliminar scripts, estilos y otros elementos no deseados
    root.querySelectorAll('script, style, nav, footer, header, aside, iframe').forEach(el => el.remove());
    
    // Extraer texto del contenido principal
    const mainContent = root.querySelector('main') || 
                        root.querySelector('article') || 
                        root.querySelector('.content') || 
                        root.querySelector('#content') || 
                        root.querySelector('.main') || 
                        root.querySelector('body');
    
    let text = '';
    
    if (mainContent) {
      // Extraer texto de párrafos, encabezados, listas, etc.
      const textElements = mainContent.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote');
      text = textElements.map(el => el.text.trim()).join('\n\n');
    } else {
      // Fallback: extraer todo el texto
      text = root.text;
    }
    
    return text;
  } catch (error) {
    logger.error('Error al extraer texto de sitio web:', error);
    throw error;
  }
}

// Función para extraer texto de YouTube (simulada)
async function extractTextFromYouTube(url) {
  try {
    // En una implementación real, se usaría la API de YouTube o un servicio de transcripción
    // Para este ejemplo, devolvemos un mensaje informativo
    return `Transcripción de video de YouTube: ${url}\n\nEsta es una implementación simulada. En una implementación real, se utilizaría la API de YouTube o un servicio de transcripción para obtener el contenido del video.`;
  } catch (error) {
    logger.error('Error al extraer texto de YouTube:', error);
    throw error;
  }
}

// Función para transcribir audio (simulada)
async function transcribeAudio(filePath) {
  try {
    // En una implementación real, se usaría un servicio de transcripción como Whisper API
    // Para este ejemplo, devolvemos un mensaje informativo
    return `Transcripción de audio: ${path.basename(filePath)}\n\nEsta es una implementación simulada. En una implementación real, se utilizaría un servicio de transcripción como Whisper API para convertir el audio a texto.`;
  } catch (error) {
    logger.error('Error al transcribir audio:', error);
    throw error;
  }
}

// Función para generar resumen
async function generateSummary(text) {
  try {
    // Limitar longitud del texto para el resumen
    const truncatedText = text.substring(0, 5000);
    
    // Obtener servicio LLM
    const { generateChatResponse } = require('./llmService');
    
    const systemPrompt = {
      role: 'system',
      content: 'Eres un asistente experto en resumir documentos. Genera un resumen conciso (máximo 200 palabras) del siguiente texto, capturando los puntos clave y la información más importante.'
    };
    
    const userPrompt = {
      role: 'user',
      content: truncatedText
    };
    
    const response = await generateChatResponse([systemPrompt, userPrompt]);
    
    return response.text;
  } catch (error) {
    logger.error('Error al generar resumen:', error);
    return 'No se pudo generar un resumen para este contenido.';
  }
}

// Función para dividir texto en chunks
function splitTextIntoChunks(text, maxChunkSize = 1000, overlap = 200) {
  const chunks = [];
  
  // Si el texto es más corto que el tamaño máximo, devolverlo como un solo chunk
  if (text.length <= maxChunkSize) {
    chunks.push(text);
    return chunks;
  }
  
  // Dividir por párrafos primero
  const paragraphs = text.split(/\n\s*\n/);
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    // Si el párrafo es muy largo, dividirlo
    if (paragraph.length > maxChunkSize) {
      // Añadir el chunk actual si no está vacío
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
      
      // Dividir párrafo largo en chunks más pequeños
      let i = 0;
      while (i < paragraph.length) {
        const chunk = paragraph.substring(i, i + maxChunkSize);
        chunks.push(chunk);
        i += maxChunkSize - overlap;
      }
    } 
    // Si añadir el párrafo excede el tamaño máximo, comenzar un nuevo chunk
    else if (currentChunk.length + paragraph.length > maxChunkSize) {
      chunks.push(currentChunk);
      currentChunk = paragraph;
    } 
    // De lo contrario, añadir el párrafo al chunk actual
    else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }
  
  // Añadir el último chunk si no está vacío
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

module.exports = { processDocument };