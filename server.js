const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

// Cargar el modelo del usuario desde la carpeta models
const User = require('./models/User');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Para servir el index.html si es necesario

// Conexión a MongoDB Atlas mediante variable de entorno
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Conectado exitosamente a MongoDB Atlas'))
  .catch(err => console.error('❌ Error de conexión a MongoDB:', err));

// Ruta principal para servir el frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Endpoint de la API para sincronizar/crear usuario desde Telegram
app.post('/api/user/sync', async (req, res) => {
  try {
    const { id, first_name, username } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: 'El Telegram ID es requerido' });
    }

    let user = await User.findOne({ telegramId: id });

    if (!user) {
      // Crear nuevo usuario si no existe
      user = new User({
        telegramId: id,
        firstName: first_name,
        username: username
      });
      await user.save();
      console.log(`✨ Nuevo usuario registrado: ${first_name} (${id})`);
    } else {
      // Actualizar último inicio de sesión
      user.lastLogin = new Date();
      await user.save();
      console.log(`🔄 Usuario sincronizado: ${first_name} (${id})`);
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error('Error en /api/user/sync:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Puerto de ejecución
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en el puerto ${PORT}`);
});
