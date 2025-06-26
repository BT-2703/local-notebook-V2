const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initializeDatabase() {
  try {
    // Verificar conexión
    const client = await pool.connect();
    logger.info('Conectado a PostgreSQL');
    
    // Ejecutar migraciones
    await runMigrations(client);
    
    client.release();
    logger.info('Base de datos inicializada correctamente');
  } catch (error) {
    logger.error('Error al inicializar la base de datos:', error);
    throw error;
  }
}

async function runMigrations(client) {
  try {
    // Crear tabla de migraciones si no existe
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Leer archivos de migración
    const migrationsDir = path.join(__dirname, 'migrations');
    const migrationFiles = await fs.readdir(migrationsDir);
    
    for (const file of migrationFiles.sort()) {
      if (file.endsWith('.sql')) {
        const migrationName = file.replace('.sql', '');
        
        // Verificar si la migración ya se ejecutó
        const result = await client.query(
          'SELECT id FROM migrations WHERE name = $1',
          [migrationName]
        );
        
        if (result.rows.length === 0) {
          logger.info(`Ejecutando migración: ${migrationName}`);
          
          // Leer y ejecutar migración
          const migrationSQL = await fs.readFile(
            path.join(migrationsDir, file),
            'utf8'
          );
          
          await client.query('BEGIN');
          await client.query(migrationSQL);
          await client.query(
            'INSERT INTO migrations (name) VALUES ($1)',
            [migrationName]
          );
          await client.query('COMMIT');
          
          logger.info(`Migración completada: ${migrationName}`);
        }
      }
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

module.exports = { pool, initializeDatabase };