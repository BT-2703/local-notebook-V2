const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Crear pool de conexión
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres123@postgres:5432/horuslm',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createUser(email, password, fullName, isAdmin = false) {
  let client;
  try {
    // Conectar a la base de datos
    client = await pool.connect();
    
    // Verificar si el usuario ya existe
    const checkResult = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (checkResult.rows.length > 0) {
      console.log(`❌ El usuario ${email} ya existe`);
      return;
    }
    
    // Generar hash de la contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Insertar nuevo usuario
    const result = await client.query(
      'INSERT INTO users (email, password_hash, full_name, is_admin) VALUES ($1, $2, $3, $4) RETURNING id, email, full_name, is_admin',
      [email, hashedPassword, fullName, isAdmin]
    );
    
    console.log(`✅ Usuario creado exitosamente: ${result.rows[0].email}`);
    console.log(`ℹ️ Detalles del usuario:`);
    console.log(`   ID: ${result.rows[0].id}`);
    console.log(`   Email: ${result.rows[0].email}`);
    console.log(`   Nombre: ${result.rows[0].full_name}`);
    console.log(`   Admin: ${result.rows[0].is_admin ? 'Sí' : 'No'}`);
  } catch (error) {
    console.error('❌ Error al crear usuario:', error);
  } finally {
    // Liberar cliente
    if (client) client.release();
    
    // Cerrar el pool de conexiones
    await pool.end();
  }
}

// Obtener parámetros de la línea de comandos
const args = process.argv.slice(2);

if (args.length < 3) {
  console.error('❌ Uso: node create-user.js <email> <password> <nombre_completo> [es_admin]');
  console.log('ℹ️ Ejemplo: node create-user.js usuario@ejemplo.com contraseña123 "Nombre Completo" true');
  process.exit(1);
}

const email = args[0];
const password = args[1];
const fullName = args[2];
const isAdmin = args[3] === 'true';

createUser(email, password, fullName, isAdmin);