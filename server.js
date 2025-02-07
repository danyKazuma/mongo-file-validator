require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors()); // Habilitar CORS para permitir peticiones desde cualquier origen

// Conexión a MongoDB sin opciones obsoletas
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 100000, // Espera hasta 50s antes de fallar
  socketTimeoutMS: 100000, // Tiempo máximo de espera para respuestas
  maxPoolSize: 10, // Límite de conexiones simultáneas
})
  .then(() => console.log('✅ Conectado a MongoDB'))
  .catch(err => console.error('❌ Error al conectar a MongoDB:', err));


// Modelos dinámicos (sin schema fijo)
const Lot = mongoose.model('Lot', new mongoose.Schema({}, { strict: false }));
const Order = mongoose.model('Order', new mongoose.Schema({}, { strict: false }));
const File = mongoose.model('File', new mongoose.Schema({}, { strict: false }));

// Función para verificar URLs
const checkURL = async (url) => {
  try {
    const response = await axios.head(url);
    return {
      valid: (response.headers['content-length'] > 12),
      url: url
    };
  } catch (error) {
    return { valid: false, url: url };
  }
};

// Endpoint principal
app.post('/api/verify', async (req, res) => {
  try {
    console.log("Solicitud recibida:", req.body);
    
    if (!req.body.lotId) {
      console.log("Error: El campo lotId es obligatorio");
      return res.status(400).json({ error: 'El campo lotId es obligatorio' });
    }
    
    const lot = await Lot.findOne({ lotNumberAndCia: req.body.lotId });
    console.log("Lote encontrado:", lot);
    
    if (!lot) {
      console.log("Error: Lote no encontrado");
      return res.status(404).json({ error: 'Lote no encontrado' });
    }
    
    const orderIds = lot.orders.map(id => id.toString());
    console.log("IDs de órdenes:", orderIds);
    
    const orders = await Order.find({ _id: { $in: orderIds } });
    console.log("Órdenes encontradas:", orders);
    
    const formattedIds = orders.map(o => o.orderId.replace(/-/g, '_'));
    console.log("IDs formateados para búsqueda de archivos:", formattedIds);
    
    const files = await File.find({
      name: { $in: formattedIds.map(id => new RegExp(`^${id}.*\.PDF$`, 'i')) }
    });
    console.log("Archivos encontrados:", files);
    
    const results = await Promise.all(files.map(file => checkURL(file.url)));
    console.log("Resultados de verificación de URLs:", results);
    
    res.json({
      // validFiles: results.filter(r => r.valid),
      invalidFiles: results.filter(r => !r.valid)
    });
    
  } catch (error) {
    console.error("Error en /api/verify:", error);
    res.status(500).json({ error: error.message });
  }
});

// Iniciar servidor en modo local o en Vercel
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'vercel') {
  app.listen(PORT, () => {
    console.log(`API ejecutándose en puerto ${PORT}`);
  });
}

// Exportar para Vercel
module.exports = app;
