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

const buscarIdPorValor = (valor, categoria) => {
  const texto = valor?.toString().toLowerCase().trim();
  return new Promise((resolve) => {
    if (!texto) return resolve(null);
    const sql = `SELECT id FROM catalogo_simple WHERE LOWER(TRIM(valor)) = ? AND categoria = ? LIMIT 1`;
    db.query(sql, [texto, categoria], (err, rows) => {
      if (err || rows.length === 0) return resolve(null);
      resolve(rows[0].id);
    });
  });
};

router.post('/importar-vilnius', upload.single('archivo'), async (req, res) => {
  const idfactura = req.body.idfactura;
  if (!idfactura || !req.file) {
    return res.status(400).send('Faltan datos requeridos (archivo o idfactura)');
  }

  db.query('SELECT idcliente FROM factura_consolidada WHERE id = ?', [idfactura], (err, rows) => {
    if (err || rows.length === 0) {
      console.error('❌ No se pudo obtener idcliente:', err);
      return res.status(404).send('Cliente no encontrado para esta factura.');
    }

    const idcliente = rows[0].idcliente;

    const workbook = xlsx.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    if (data.length === 0) return res.status(400).send('El archivo Excel está vacío.');
    console.log('🔍 Encabezados:', Object.keys(data[0]));

    const insertarFila = async (fila, callback) => {
      const codigo = fila['Cod']?.toString().trim() || '';
      const product = fila['Product']?.toString().trim() || '';
      const lengthStr = fila['Length']?.toString().trim();
      const boxType = fila['box type']?.toString().toLowerCase().trim();
      const stems = parseInt(fila['STEMS']) || 0;
      const rawCantidad = fila['number of boxes'];
      const length = parseInt(lengthStr);

      const idlongitud = await buscarIdPorValor(lengthStr, 'longitud');

      let idtipocaja = null;
      if (boxType === 'qb') idtipocaja = 1;
      else if (boxType === 'hb') idtipocaja = 2;
      else if (!boxType && stems === 100 && [40, 50, 60, 70, 80, 90].includes(length)) {
        idtipocaja = 1;
      }

      let cantidad = parseFloat(rawCantidad);
      if (!cantidad || isNaN(cantidad)) {
        const condicionesQB = idtipocaja === 1 && [40, 50, 60, 70, 80, 90].includes(length) && stems === 100;
        const condicionesHB =
          idtipocaja === 2 && (
            (length === 40 && stems === 300) ||
            (length === 50 && stems === 300) ||
            (length === 60 && stems === 250) ||
            (length === 70 && stems >= 150 && stems <= 200) ||
            (length === 80 && stems === 200) ||
            (length === 90 && stems === 200) ||
            (length === 100 && stems === 200)
          );

        if (condicionesQB || condicionesHB) {
          cantidad = 1;
        } else {
          cantidad = 1;
          idtipocaja = 47;
        }
      }

      let cantidadTallos = parseInt(fila['STEMS']) || null;
      if (!cantidadTallos) {
        if (idtipocaja === 1 && [40, 50, 60, 70, 80, 90].includes(length)) {
          cantidadTallos = 100;
        } else if (idtipocaja === 2) {
          if ([40, 50].includes(length)) cantidadTallos = 300;
          else if (length === 60) cantidadTallos = 250;
          else if ([70, 80, 90, 100].includes(length)) cantidadTallos = 200;
        }
      }

      const totaltallos = cantidad && cantidadTallos ? cantidad * cantidadTallos : null;
      const pedido = {
        idfactura,
        idcliente,
        codigo,
        observaciones: product,
        idlongitud,
        idtipocaja,
        cantidad,
        tallos: cantidadTallos,
        totaltallos
      };

      const sql = 'INSERT INTO pedidos SET ?';
      db.query(sql, pedido, (err) => {
        if (err) {
          console.error('❌ Error al insertar fila:', err.message);
          console.log('Valores:', pedido);
        } else {
          console.log('✅ Pedido insertado:', pedido);
        }
        callback();
      });
    };

    let pendientes = data.length;
    data.forEach((fila) => {
      insertarFila(fila, () => {
        pendientes--;
        if (pendientes === 0) {
          res.send('✅ Pedidos de Vilnius importados correctamente.');
        }
      });
    });
  });
});

module.exports = router;
