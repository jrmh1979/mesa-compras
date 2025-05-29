require('dotenv').config();
const mysql = require('mysql2');

const connection = mysql.createConnection(process.env.DATABASE_URL);

connection.connect((err) => {
  if (err) {
    console.error('❌ Error al conectar a PlanetScale:', err.message);
  } else {
    console.log('✅ Conectado exitosamente a PlanetScale');
  }
});

module.exports = connection;
