const mysql = require('mysql2');
require('dotenv').config();

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: true,
  },
});

db.connect((err) => {
  if (err) {
    console.error('❌ Error al conectar a PlanetScale:', err.message);
  } else {
    console.log('✅ Conectado a PlanetScale');
  }
});

module.exports = db;
