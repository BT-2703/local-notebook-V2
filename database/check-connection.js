const { Pool } = require('pg');
require('dotenv').config();

// Crear pool de conexión
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres123@postgres:5432/horuslm',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkDatabaseConnection() {
  let client;
  try {
    // Intentar conectar a la base de datos
    client = await pool.connect();
    console.log('✅ Conexión a PostgreSQL exitosa');
    
    // Verificar si la tabla de usuarios existe
    const tableResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    if (tableResult.rows[0].exists) {
      console.log('✅ Tabla de usuarios encontrada');
      
      // Verificar si hay usuarios en la tabla
      const userResult = await client.query('SELECT COUNT(*) FROM users');
      const userCount = parseInt(userResult.rows[0].count);
      
      console.log(`ℹ️ Número de usuarios en la base de datos: ${userCount}`);
      
      // Verificar usuario administrador
      const adminResult = await client.query(`
        SELECT * FROM users WHERE is_admin = true LIMIT 1
      `);
      
      if (adminResult.rows.length > 0) {
        const admin = adminResult.rows[0];
        console.log(`✅ Usuario administrador encontrado: ${admin.email}`);
        console.log(`ℹ️ Credenciales por defecto:`);
        console.log(`   Email: ${admin.email}`);
        console.log(`   Contraseña: admin123 (si no ha sido cambiada)`);
      } else {
        console.log('❌ No se encontró ningún usuario administrador');
      }
    } else {
      console.error('❌ La tabla de usuarios no existe');
    }
  } catch (error) {
    console.error('❌ Error al conectar a la base de datos:', error);
  } finally {
    // Liberar cliente
    if (client) client.release();
    
    // Cerrar el pool de conexiones
    await pool.end();
  }
}

checkDatabaseConnection();