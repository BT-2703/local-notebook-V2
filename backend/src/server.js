const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');
const { initializeDatabase } = require('./database/init');
const logger = require('./utils/logger');

// Cargar variables de entorno
dotenv.config();

// Inicializar Express
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/audio', express.static(path.join(__dirname, '../audio')));

// Rutas
const authRoutes = require('./routes/auth');
const notebooksRoutes = require('./routes/notebooks');
const sourcesRoutes = require('./routes/sources');
const chatRoutes = require('./routes/chat');
const audioRoutes = require('./routes/audio');
const adminRoutes = require('./routes/admin');

// Montar rutas - Eliminar el prefijo /api para que coincida con el frontend
app.use('/auth', authRoutes);
app.use('/notebooks', notebooksRoutes);
app.use('/sources', sourcesRoutes);
app.use('/chat', chatRoutes);
app.use('/audio', audioRoutes);
app.use('/admin', adminRoutes);

// Ruta de estado
app.get('/status', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

// Middleware de manejo de errores
app.use((err, req, res, next) => {
  logger.error('Error no controlado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Iniciar el servidor
const startServer = async () => {
  try {
    // Inicializar la base de datos
    await initializeDatabase();
    
    app.listen(PORT, () => {
      logger.info(`Servidor iniciado en http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error('Error al iniciar el servidor:', error);
    process.exit(1);
  }
};

startServer();