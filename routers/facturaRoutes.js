const express = require('express');
const router = express.Router();
const db = require('../db');

// Confirmar compra con todos los campos, incluyendo cálculos y usuario
router.post('/confirmar-compra', (req, res) => {
  const {
    idfactura,
    idpedido,
    codigo,
    idproveedor,
    idproducto,
    idvariedad,
    idlongitud,
    idempaque,
    idtipocaja,
    cantidad,
    precio_unitario,
    idusuario,
    cantidadTallos,
    cantidadRamos,
    subtotal,
    tallos
  } = req.body;

  // Validación básica
  if (
    !idfactura || !idpedido || !codigo || !idproveedor ||
    !idproducto || !idvariedad || !idlongitud || !idempaque ||
    !idtipocaja || !cantidad || !precio_unitario || !idusuario ||
    !cantidadTallos || !cantidadRamos || !subtotal|| !tallos
  ) {
    return res.status(400).send('Faltan datos requeridos');
  }

  const sql = `
    INSERT INTO factura_consolidada_detalle (
      idfactura, idpedido, codigo, idproveedor,
      idproducto, idvariedad, idlongitud, idempaque,
      idtipocaja, cantidad, precio_unitario, 
      cantidadTallos, cantidadRamos, subtotal,
      idusuario, fechacompra
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
  `;

  db.query(sql, [
    idfactura,
    idpedido,
    codigo,
    idproveedor,
    idproducto,
    idvariedad,
    idlongitud,
    idempaque,
    idtipocaja,
    cantidad,
    precio_unitario,
    cantidadTallos,
    cantidadRamos,
    subtotal,
    idusuario
    
  ], (err) => {
    if (err) {
      console.error('❌ Error al guardar detalle de compra:', err.message);
      return res.status(500).send('Error al guardar compra');
    }

  console.log('🔍 Actualizar pedido:', {
  idpedido,
  cantidad,
  tallos,
  sql: `
    UPDATE pedidos
    SET
      cantidad = IFNULL(cantidad, 0) - ${cantidad},
      totaltallos = IFNULL(totaltallos, 0) - (${cantidad} * ${tallos})
    WHERE idpedido = ${idpedido}
  `
});

    // ✅ Después de guardar, actualizamos el saldo en la tabla pedidos
    const sqlUpdate = `
      UPDATE pedidos
      SET
        cantidad = IFNULL(cantidad, 0) - ?,
        totaltallos = IFNULL(totaltallos, 0) - (? * ?)
      WHERE idpedido = ?
    `;

    db.query(sqlUpdate, [cantidad, cantidad, tallos, idpedido], (err2) => {
      if (err2) {
        console.error('❌ Error al actualizar pedido:', err2.message);
        return res.status(500).send('Error al actualizar saldo del pedido');
      }

      res.status(200).json({ success: true, message: '✅ Compra guardada y pedido actualizado' });
    });

  });
});


// ✅ NUEVA RUTA: Obtener el número máximo de factura
router.get('/factura/max-numero', (req, res) => {
  const sql = `SELECT MAX(numero_factura) AS max FROM factura_consolidada`;
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error al obtener el número máximo de factura:', err);
      return res.status(500).json({ error: 'Error en el servidor' });
    }
    const max = results[0].max || 0;
    res.json({ max });
  });
});

router.post('/factura', (req, res) => {
  const { numero_factura, idcliente, fecha, fecha_vuelo } = req.body;

  if (!numero_factura || !idcliente || !fecha) {
    return res.status(400).json({ error: 'Faltan datos' });
  }

  const sql = `
    INSERT INTO factura_consolidada (numero_factura, idcliente, fecha, fecha_vuelo, estado)
    VALUES (?, ?, ?, ?, 'proceso')
  `;

  db.query(sql, [numero_factura, idcliente, fecha, fecha_vuelo], (err, result) => {
    if (err) {
      console.error('❌ Error al insertar factura:', err.message);
      return res.status(500).json({ error: 'Error al insertar factura' });
    }

    res.json({ message: '✅ Factura registrada correctamente', idFactura: result.insertId });
  });
});

//Detalle Facturas

router.get('/factura-detalle/:idfactura', (req, res) => {
  const { idfactura } = req.params;

  const sql = `
    SELECT * FROM factura_consolidada_detalle
    WHERE idfactura = ?
  `;

  db.query(sql, [idfactura], (err, results) => {
    if (err) {
      console.error('❌ Error al obtener detalle de factura:', err.message);
      return res.status(500).send('Error al obtener detalles');
    }
    res.json(results);
  });
});

// ✅ Actualizar campo en factura_consolidada_detalle
router.put('/factura-detalle/:iddetalle', (req, res) => {
  const { iddetalle } = req.params;
  const { campo, valor } = req.body;

  const sql = `UPDATE factura_consolidada_detalle SET \`${campo}\` = ? WHERE iddetalle = ?`;

  db.query(sql, [valor, iddetalle], (err, result) => {
    if (err) {
      console.error('❌ Error al actualizar detalle:', err.message);
      return res.status(500).send('Error al actualizar detalle');
    }
    res.json({ success: true });
  });
});


//campos de encabezado facturas editables 
router.put('/factura/:id', (req, res) => {
  const { id } = req.params;
  const { campo, valor } = req.body;

  const sql = `UPDATE factura_consolidada SET ${campo} = ? WHERE id = ?`;
  db.query(sql, [valor, id], (err, result) => {
    if (err) {
      console.error('❌ Error al actualizar campo:', err);
      return res.status(500).send('Error al actualizar factura');
    }
    res.json({ success: true });
  });
});




// ✅ selecciona el pedido con datos
router.get('/facturas-con-clientes', (req, res) => {
  const sql = `
    SELECT 
      f.id AS idfactura,
      f.numero_factura,
      f.fecha,
      f.fecha_vuelo,
      f.awb,
      f.hawb,
      f.idcarguera,
      f.iddae,
      f.estado,
      f.idcliente,
      t.nombre AS cliente
    FROM factura_consolidada f
    JOIN terceros t ON f.idcliente = t.idtercero
    WHERE f.estado = 'proceso'
    ORDER BY f.fecha DESC
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      console.error('❌ Error al obtener facturas:', err);
      return res.status(500).send('Error al obtener facturas');
    }
    res.json(rows);
  });
});

// ✅ Obtener lista de proveedores desde la tabla terceros
router.get('/proveedores', (req, res) => {
  const sql = `
    SELECT idtercero AS id, nombre, 'proveedor' AS tipo
    FROM terceros
    WHERE tipo = 'proveedor'
    ORDER BY nombre
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      console.error('❌ Error al obtener proveedores:', err);
      return res.status(500).send('Error al obtener proveedores');
    }
    res.json(rows);
  });
});

//Asignar guias aereas
router.put('/asignar-awb', async (req, res) => {
  const { idfactura, grupo, awb } = req.body;
  try {
    await db.promise().query(
      `UPDATE factura_consolidada_detalle 
       SET guia_master = ? 
       WHERE idfactura = ? AND idgrupo = ?`,
      [awb, idfactura, grupo]
    );
    res.send({ success: true });
  } catch (err) {
    console.error('❌ Error al asignar AWB:', err);
    res.status(500).send({ error: 'Error al asignar AWB' });
  }
});

// Obtener lista única de categorías disponibles en catalogo_simple
router.get('/catalogo-simple/categorias', async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT DISTINCT categoria 
      FROM catalogo_simple 
      WHERE categoria IS NOT NULL AND categoria != ''
      ORDER BY categoria
    `);
    const categorias = rows.map(r => r.categoria);
    res.json(categorias);
  } catch (err) {
    console.error('❌ Error al obtener categorías:', err);
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
});

router.get('/catalogo-simple', async (req, res) => {
  const categoria = req.query.categoria;
  if (!categoria) return res.status(400).json({ error: 'Falta la categoría' });

  try {
    const [rows] = await db.promise().query(
      'SELECT id, valor FROM catalogo_simple WHERE categoria = ? ORDER BY valor',
      [categoria]
    );
    res.json(rows);
  } catch (err) {
    console.error('❌ Error al listar:', err);
    res.status(500).json({ error: 'Error al obtener datos' });
  }
});

router.post('/catalogo-simple', async (req, res) => {
  const { categoria, valor } = req.body;
  if (!categoria || !valor) return res.status(400).json({ error: 'Datos incompletos' });

  try {
    await db.promise().query(
      'INSERT INTO catalogo_simple (categoria, valor) VALUES (?, ?)',
      [categoria, valor]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Error al agregar:', err);
    res.status(500).json({ error: 'Error al agregar' });
  }
});

router.put('/catalogo-simple/:id', async (req, res) => {
  const id = req.params.id;
  const { campo, valor } = req.body;

  if (!campo || typeof valor === 'undefined') {
    return res.status(400).json({ error: 'Datos incompletos' });
  }

  try {
    await db.promise().query(
      `UPDATE catalogo_simple SET ${campo} = ? WHERE id = ?`,
      [valor, id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Error al editar:', err);
    res.status(500).json({ error: 'Error al editar' });
  }
});

router.delete('/catalogo-simple/:id', async (req, res) => {
  const id = req.params.id;
  try {
    await db.promise().query('DELETE FROM catalogo_simple WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Error al eliminar:', err);
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

// Obtener todo el catálogo sin filtrar por categoría
router.get('/catalogo-simple/todo', async (req, res) => {
  try {
    const [rows] = await db.promise().query('SELECT * FROM catalogo_simple ORDER BY categoria, valor');
    res.json(rows);
  } catch (err) {
    console.error('❌ Error al obtener todo el catálogo:', err);
    res.status(500).json({ error: 'Error al obtener catálogo completo' });
  }
});


//GUARDAR Y ELIMINAR CAJA MIXTA
router.post('/factura-detalle/crear-mixta', async (req, res) => {
  const { iddetalle_original, mixItems } = req.body;

  try {
    console.log('🟡 Recibido:', { iddetalle_original, mixItems });

    // Eliminar el detalle original
    await db.promise().query(
      'DELETE FROM factura_consolidada_detalle WHERE iddetalle = ?',
      [iddetalle_original]
    );

    // Insertar cada item del mix con los nuevos campos
    for (const item of mixItems) {
      console.log('🧩 Insertando item:', item);

      await db.promise().query('INSERT INTO factura_consolidada_detalle SET ?', {
        idfactura: item.idfactura,
        codigo: item.codigo,
        idpedido: item.idpedido,               // ✅ NUEVO
        idgrupo: item.idgrupo  || 5, // ✅ si no viene, usar id 5 que representa grupo 'A'
        idproveedor: item.idproveedor,
        idproducto: item.idproducto,
        idvariedad: item.idvariedad,
        idlongitud: item.idlongitud,
        idempaque: item.idempaque,
        idtipocaja: item.tipo_caja_variedad,
        cantidad: item.cantidad,
        cantidadRamos: item.cantidadRamos,
        cantidadTallos: item.cantidadTallos,
        precio_unitario: item.precio_unitario,
        precio_venta: item.precio_venta,
        subtotal: item.subtotal,
        documento_proveedor: item.documento_proveedor,
        idusuario: item.idusuario,
        fechacompra: item.fechacompra,
        idmix: iddetalle_original
      });
    }

    res.json({ success: true, message: '✅ Caja mixta guardada correctamente.' });
  } catch (error) {
    console.error('❌ Error al guardar caja mixta:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

//PEGADO DESDE EXCEL 
router.post('/pedidos', (req, res) => {
   console.log('🟢 Datos recibidos en /pedidos:', req.body); // <-- Agregado

  const {
    idfactura,
    idcliente,
    codigo, // ✅ nuevo campo
    idproducto,
    idvariedad,
    idlongitud,
    idempaque,
    cantidad,
    tallos,
    totaltallos,
    observaciones
  } = req.body;

  if (!idfactura || !idcliente) {
    return res.status(400).send('Faltan datos requeridos');
  }

  const sql = `
    INSERT INTO pedidos (
      idfactura, idcliente, codigo,
      idproducto, idvariedad, idlongitud, idempaque,
      cantidad, tallos, totaltallos, observaciones
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const valores = [
    idfactura, idcliente, codigo,
    idproducto, idvariedad, idlongitud, idempaque,
    cantidad, tallos, totaltallos, observaciones
  ];

  db.query(sql, valores, (err, result) => {
    if (err) {
      console.error('❌ Error al insertar pedido:', err.message);
      return res.status(500).send('Error al insertar pedido');
    }

    res.json({ success: true, idpedido: result.insertId });
  });
});

//CALCULAR PESOS
router.post('/factura-detalle/calcular-pesos/:idFactura', async (req, res) => {
  const { idFactura } = req.params;
  try {
    const [detalles] = await db.promise().query(`
      SELECT fd.iddetalle, fd.idproducto, fd.idtipocaja, fd.cantidadTallos
      FROM factura_consolidada_detalle fd
      WHERE fd.idfactura = ?
    `, [idFactura]);

    console.log("🟢 DETALLES FACTURA:", detalles);

    const [reglasRaw] = await db.promise().query(`
      SELECT valor FROM catalogo_simple WHERE categoria = 'regla_peso'
    `);

    const reglas = reglasRaw.map(r => {
      const [idtipocaja, idproducto, rango, peso] = r.valor.split("|");
      return {
        idtipocaja: parseInt(idtipocaja),
        idproducto: parseInt(idproducto),
        rango,
        peso: parseFloat(peso)
      };
    });

    console.log("📏 REGLAS DE PESO:", reglas);

    const calcularPeso = (row) => {
      for (const regla of reglas) {
        const [min, max] = regla.rango.split("-").map(Number);
        if (
          row.idtipocaja === regla.idtipocaja &&
          row.idproducto === regla.idproducto &&
          row.cantidadTallos >= min && row.cantidadTallos <= max
        ) {
          console.log(`✅ Coincidencia encontrada para ID ${row.iddetalle}: peso = ${regla.peso}`);
          return regla.peso;
        }
      }
      console.log(`❌ Sin coincidencia para ID ${row.iddetalle}`);
      return 0.0;
    };

    for (const row of detalles) {
      const peso = calcularPeso(row);
      await db.promise().query(`
        UPDATE factura_consolidada_detalle
        SET peso = ?
        WHERE iddetalle = ?
      `, [peso, row.iddetalle]);
    }

    res.status(200).json({ message: "Pesos actualizados correctamente" });
  } catch (error) {
    console.error("❌ Error al calcular pesos:", error);
    res.status(500).json({ error: "Error al calcular pesos" });
  }
});


module.exports = router;
