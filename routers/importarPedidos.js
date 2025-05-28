// backend/importarPedidos.js
const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const db = require('../db');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

router.post('/importar-pedidos', upload.single('archivo'), async (req, res) => {
  const idfactura = req.body.idfactura;
  if (!idfactura || !req.file) {
    return res.status(400).send('Faltan datos requeridos (archivo o idfactura)');
  }

  const idcliente = await new Promise((resolve) => {
    db.query('SELECT idcliente FROM factura_consolidada WHERE id = ?', [idfactura], (err, rows) => {
      if (err || rows.length === 0) return resolve(null);
      resolve(rows[0].idcliente);
    });
  });

  if (!idcliente) return res.status(404).send('Cliente no encontrado para esta factura.');

  const workbook = xlsx.readFile(req.file.path);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet, { defval: '' });

  if (data.length > 0) {
    console.log('🔍 Encabezados detectados en el Excel:', Object.keys(data[0]));
  }

  const normalizar = (texto) => texto?.toString().toLowerCase().trim();

  const columnas = Object.keys(data[0]).reduce((mapa, key) => {
    mapa[normalizar(key)] = key;
    return mapa;
  }, {});

  const buscarIdPorValor = async (valor, categoria = null, tabla = 'catalogo_simple') => {
    const texto = normalizar(valor);
    return new Promise((resolve) => {
      let sql = `SELECT id FROM ${tabla} WHERE LOWER(TRIM(valor)) LIKE ?`;
      const params = [`%${texto}%`];

      if (categoria) {
        sql += ' AND categoria = ?';
        params.push(categoria);
      }

      sql += ' LIMIT 1';

      db.query(sql, params, (err, rows) => {
        if (err || rows.length === 0) return resolve(null);
        resolve(rows[0].id);
      });
    });
  };

  const buscarIdProveedor = async (nombre) => {
    const texto = normalizar(nombre);
    return new Promise((resolve) => {
      if (!texto) return resolve(null);
      const sql = `SELECT idtercero FROM terceros WHERE LOWER(TRIM(nombre)) LIKE ? AND tipo = 'proveedor' LIMIT 1`;
      db.query(sql, [`%${texto}%`], (err, rows) => {
        if (err || rows.length === 0) return resolve(null);
        resolve(rows[0].idtercero);
      });
    });
  };

  const insertarPedido = async (fila) => {
    const clientCode = fila[columnas['client code']];
    const variety = fila[columnas['variety']];
    const product = fila[columnas['product']];
    const length = fila[columnas['length/grade']];
    const stemsPerBunch = fila[columnas['stems x bunch']];
    const boxes = fila[columnas['boxes']];
    const stems = fila[columnas['stems']];
    const totalStems = fila[columnas['total stems']];
    const orderType = fila[columnas['order type']];
    const farm = fila[columnas['farm']];

    const idproducto = await buscarIdPorValor(product);
    const idvariedad = await buscarIdPorValor(variety, 'variedad');
    const idlongitud = await buscarIdPorValor(length, 'longitud');
    const idempaque = await buscarIdPorValor(stemsPerBunch, 'empaque');
    const idOrder = await buscarIdPorValor(orderType, 'tipopedido');
    const idproveedor = farm ? await buscarIdProveedor(farm) : null;

    const observaciones = [variety];
    if (farm) observaciones.push(`Finca: ${farm}`);

    const sql = `
      INSERT INTO pedidos (
        idfactura, codigo, observaciones, idproducto, idvariedad,
        idlongitud, idempaque, cantidad, tallos, totaltallos,
        idOrder, idcliente, idproveedor
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const valores = [
      idfactura,
      clientCode,
      observaciones.join(' | '),
      idproducto,
      idvariedad,
      idlongitud,
      idempaque,
      boxes,
      stems,
      totalStems,
      idOrder,
      idcliente,
      idproveedor
    ];

    return new Promise((resolve) => {
      db.query(sql, valores, (err) => {
        if (err) {
          console.error('❌ Error al insertar pedido:', err.message);
          console.log('Valores:', valores);
        } else {
          console.log('✅ Pedido insertado:', valores);
        }
        resolve(!err);
      });
    });
  };

  Promise.all(data.map(insertarPedido)).then(() => {
    res.send('✅ Pedidos importados correctamente');
  });
});

module.exports = router;
