const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const notebooksRoutes = require('./routes/notebooks');
const sourcesRoutes = require('./routes/sources');
const chatRoutes = require('./routes/chat');
const adminRoutes = require('./routes/admin');
const audioRoutes = require('./routes/audio');

const { initializeDatabase } = require('./database/init');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware de seguridad
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por ventana
  message: 'Demasiadas solicitudes desde esta IP, intenta de nuevo más tarde.'
});
app.use('/api/', limiter);

// Middleware general
app.use(compression());
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir archivos estáticos
app.use('/uploads', express.static('uploads'));
app.use('/audio', express.static('audio'));

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/notebooks', notebooksRoutes);
app.use('/api/sources', sourcesRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/audio', audioRoutes);

// Ruta de salud
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Manejo de errores
app.use((err, req, res, next) => {
  logger.error('Error no manejado:', err);
  res.status(500).json({ 
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Algo salió mal'
  });
});

// Ruta 404
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Inicializar base de datos y servidor
async function startServer() {
  try {
    await initializeDatabase();
    logger.info('Base de datos inicializada correctamente');
    
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Servidor HorusLM ejecutándose en puerto ${PORT}`);
      logger.info(`📊 Panel de administración: http://localhost:${PORT}/api/admin`);
    });
  } catch (error) {
    logger.error('Error al iniciar el servidor:', error);
    process.exit(1);
  }
}

// Manejo de señales de cierre
process.on('SIGTERM', () => {
  logger.info('Recibida señal SIGTERM, cerrando servidor...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('Recibida señal SIGINT, cerrando servidor...');
  process.exit(0);
});

startServer();