const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const db = require('./db');
const importarPedidos = require('./routers/importarPedidos');
const facturaRoutes = require('./routers/facturaRoutes');
const importarVilniusRoutes = require('./routers/importarVilnius');


const app = express();
const port = process.env.PORT || 5000;

// ✅ Configurar CORS antes de rutas
const corsOptions = {
  origin: 'https://mesa-compras-frontend.vercel.app',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // preflight


// Middleware
app.use(bodyParser.json());

// Rutas externas
app.use(importarPedidos);
app.use(facturaRoutes);
app.use(importarVilniusRoutes);

// Ruta base
app.get('/', (req, res) => {
  res.send('✅ Servidor funcionando');
});

// Ruta de prueba de conexión
app.get('/ping', (req, res) => {
  res.send('✅ Backend activo y base de datos conectada');
});


// Ruta para registrar usuario con contraseña encriptada
app.post('/usuarios', async (req, res) => {
  const { nombre, correo, contrasena } = req.body;

  if (!nombre || !correo || !contrasena) {
    return res.status(400).send('Faltan datos requeridos');
  }

  try {
    const hash = await bcrypt.hash(contrasena, 10); // 10 es el número de "salt rounds"

    const sql = 'INSERT INTO usuarios (nombre, correo, contrasena) VALUES (?, ?, ?)';
    db.query(sql, [nombre, correo, hash], (err, result) => {
      if (err) {
        console.error('❌ Error al insertar usuario:', err.message);
        return res.status(500).send('Error al registrar usuario');
      }

      res.send('✅ Usuario registrado correctamente con contraseña segura');
    });
  } catch (error) {
    console.error('❌ Error en hash:', error.message);
    res.status(500).send('Error al procesar contraseña');
  }
});

// Ruta de LOGIN
app.post('/login', (req, res) => {
  const { correo, contrasena } = req.body;

  if (!correo || !contrasena) {
    return res.status(400).send('Faltan datos de inicio de sesión');
  }

  const sql = 'SELECT * FROM usuarios WHERE correo = ?';
  db.query(sql, [correo], async (err, results) => {
    if (err) {
      console.error('❌ Error en login:', err.message);
      return res.status(500).send('Error del servidor');
    }

    if (results.length === 0) {
      return res.status(401).send('Correo no registrado');
    }

    const usuario = results[0];
    const coincide = await bcrypt.compare(contrasena, usuario.contrasena);

    if (!coincide) {
      return res.status(401).send('Contraseña incorrecta');
    }

    res.json({ idusuario: usuario.id, nombre: usuario.nombre }); // ✅ Retorna datos reales
  });
});

app.post('/factura', (req, res) => {
  const { numero_factura, idcliente, fecha, fecha_vuelo } = req.body;

  if (!numero_factura || !idcliente || !fecha) {
    return res.status(400).send('Faltan datos requeridos');
  }

  const sql = `
    INSERT INTO factura_consolidada (numero_factura, idcliente, fecha, fecha_vuelo)
    VALUES (?, ?, ?, ?)
  `;

  db.query(sql, [numero_factura, idcliente, fecha, fecha_vuelo], (err, result) => {
    if (err) {
      console.error('❌ Error al insertar factura:', err.message);
      return res.status(500).send('Error al registrar factura');
    }

    const idFactura = result.insertId;
    res.json({ message: '✅ Factura registrada', idFactura });
  });
});

// Seleccionar Cliente
app.get('/clientes', (req, res) => {
  const sql = 'SELECT idtercero AS id, nombre FROM terceros WHERE tipo = "cliente"';
  db.query(sql, (err, results) => {
    if (err) {
      console.error('❌ Error al obtener clientes:', err.message);
      return res.status(500).send('Error al obtener clientes');
    }
    res.json(results);
  });
});

// Seleccionar Proveedor
app.get('/proveedores', (req, res) => {
  const sql = 'SELECT idtercero AS id, nombre FROM terceros WHERE tipo = "proveedor"';
  db.query(sql, (err, results) => {
    if (err) {
      console.error('❌ Error al obtener proveedores:', err.message);
      return res.status(500).send('Error al obtener proveedores');
    }
    res.json(results);
  });
});

// Obtener terceros por tipo (cliente o proveedor)
app.get('/terceros', (req, res) => {
  const { tipo } = req.query;

  if (!tipo) {
    return res.status(400).send('Falta el tipo (cliente o proveedor)');
  }

  const sql = 'SELECT idtercero, nombre, telefono, correo FROM terceros WHERE tipo = ?';
  db.query(sql, [tipo], (err, results) => {
    if (err) {
      console.error('❌ Error al obtener terceros:', err.message);
      return res.status(500).send('Error al obtener terceros');
    }
    res.json(results);
  });
});

// Actualizar o modificar terceros por tipo (cliente o proveedor)
app.put('/terceros/:id', (req, res) => {
  const { nombre, telefono, correo } = req.body;
  const { id } = req.params;

  const sql = 'UPDATE terceros SET nombre = ?, telefono = ?, correo = ? WHERE idtercero = ?';
  db.query(sql, [nombre, telefono, correo, id], (err) => {
    if (err) {
      console.error('❌ Error al actualizar tercero:', err.message);
      return res.status(500).send('Error al actualizar tercero');
    }
    res.send('✅ Tercero actualizado');
  });
});

// agregar terceros por tipo (cliente o proveedor)
app.post('/terceros', (req, res) => {
  const { nombre, telefono, correo, tipo } = req.body;

  if (!nombre || !tipo) {
    return res.status(400).send('Faltan datos requeridos');
  }

  const sql = 'INSERT INTO terceros (nombre, telefono, correo, tipo) VALUES (?, ?, ?, ?)';
  db.query(sql, [nombre, telefono, correo, tipo], (err) => {
    if (err) {
      console.error('❌ Error al agregar tercero:', err.message);
      return res.status(500).send('Error al agregar tercero');
    }
    res.send('✅ Tercero agregado');
  });
});


// Obtener todos los pedidos
app.get('/pedidos', (req, res) => {
  db.query('SELECT * FROM pedidos', (err, rows) => {
    if (err) {
      console.error('❌ Error al obtener pedidos:', err.message);
      return res.status(500).send('Error al obtener pedidos');
    }
    res.json(rows);
  });
});

// Obtener catálogo completo
app.get('/catalogo-simple', (req, res) => {
  db.query('SELECT id, categoria, valor FROM catalogo_simple', (err, rows) => {
    if (err) {
      console.error('❌ Error al obtener catálogo simple:', err.message);
      return res.status(500).send('Error al obtener catálogo simple');
    }
    res.json(rows);
  });
});

// Actualizar campo editable en pedidos
app.put('/pedidos/:id', (req, res) => {
  const { campo, valor } = req.body;
  const id = req.params.id;

  if (!campo || valor === undefined) {
    return res.status(400).send('Campo o valor faltante');
  }

  const sql = `UPDATE pedidos SET \`${campo}\` = ? WHERE idpedido = ?`;
  db.query(sql, [valor, id], (err, result) => {
    if (err) {
      console.error('❌ Error al actualizar pedido:', err.message);
      return res.status(500).send('Error al actualizar pedido');
    }
    res.send('✅ Pedido actualizado');
  });
});

 //Pegar registros en pedidos
app.post('/pedidos', (req, res) => {
  const {
    idfactura,
    idcliente,
    idproducto,
    idvariedad,
    idlongitud,
    idempaque,
    cantidad,
    tallos,
    totaltallos
  } = req.body;

  if (!idfactura || !idcliente) {
    return res.status(400).send('Faltan datos obligatorios');
  }

  const sql = `
    INSERT INTO pedidos (
      idfactura, idcliente, idproducto, idvariedad,
      idlongitud, idempaque, cantidad, tallos, totaltallos
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(sql, [
    idfactura,
    idcliente,
    idproducto,
    idvariedad,
    idlongitud,
    idempaque,
    cantidad,
    tallos,
    totaltallos || (cantidad * tallos)
  ], (err, result) => {
    if (err) {
      console.error('❌ Error al insertar pedido:', err.message);
      return res.status(500).send('Error al guardar pedido');
    }
    res.send('✅ Pedido guardado');
  });
});

//seleccion de pedidos
app.get('/facturas-con-clientes', (req, res) => {
  const sql = `
    SELECT f.id AS idfactura, f.idcliente, t.nombre AS cliente
    FROM factura_consolidada f
    JOIN terceros t ON f.idcliente = t.idtercero
  `;
  db.query(sql, (err, rows) => {
    if (err) {
      console.error('❌ Error al obtener facturas:', err.message);
      return res.status(500).send('Error al obtener facturas');
    }
    res.json(rows);
  });
});

// Eliminar registro de Pedidos

app.delete('/pedidos-multiples', (req, res) => {
  const { ids } = req.body; // espera un array de IDs

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).send('No se enviaron registros a eliminar');
  }

  const placeholders = ids.map(() => '?').join(',');
  const sql = `DELETE FROM pedidos WHERE idpedido IN (${placeholders})`;

  db.query(sql, ids, (err, result) => {
    if (err) {
      console.error('❌ Error al eliminar múltiples pedidos:', err.message);
      return res.status(500).send('Error al eliminar pedidos');
    }
    res.send('✅ Pedidos eliminados');
  });
});

// Obtener todas las facturas con sus detalles
app.get('/facturas-detalle', (req, res) => {
  const sqlFacturas = `
    SELECT 
      f.id AS idfactura,
      f.numero_factura,
      f.fecha,
      f.fecha_vuelo,
      f.idcliente,
      t.nombre AS cliente
    FROM factura_consolidada f
    LEFT JOIN terceros t ON f.idcliente = t.idtercero
    ORDER BY f.fecha DESC
  `;

  const sqlDetalles = `
    SELECT 
      d.*,
      c1.valor AS producto,
      c2.valor AS variedad,
      c3.valor AS longitud,
      c4.valor AS empaque,
      c5.valor AS tipo_caja,
      p.nombre AS proveedor
    FROM factura_consolidada_detalle d
    LEFT JOIN catalogo_simple c1 ON d.idproducto = c1.id
    LEFT JOIN catalogo_simple c2 ON d.idvariedad = c2.id
    LEFT JOIN catalogo_simple c3 ON d.idlongitud = c3.id
    LEFT JOIN catalogo_simple c4 ON d.idempaque = c4.id
    LEFT JOIN catalogo_simple c5 ON d.idtipocaja = c5.id
    LEFT JOIN terceros p ON d.idproveedor = p.idtercero
  `;

  // Ejecutamos ambas consultas en paralelo
  db.query(sqlFacturas, (errFacturas, facturas) => {
    if (errFacturas) {
      console.error('❌ Error al obtener facturas:', errFacturas.message);
      return res.status(500).send('Error al obtener facturas');
    }

    db.query(sqlDetalles, (errDetalles, detalles) => {
      if (errDetalles) {
        console.error('❌ Error al obtener detalles:', errDetalles.message);
        return res.status(500).send('Error al obtener detalles');
      }

      // Asociar detalles a su factura correspondiente
      const facturasConDetalle = facturas.map(factura => ({
        ...factura,
        detalles: detalles.filter(d => d.idfactura === factura.idfactura)
      }));

      res.json(facturasConDetalle);
    });
  });
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`🚀 Servidor en: http://localhost:${port}`);
});
