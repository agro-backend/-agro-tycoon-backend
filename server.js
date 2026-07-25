const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const User = require('./models/User');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Conectado exitosamente a MongoDB Atlas'))
  .catch(err => console.error('❌ Error de conexión a MongoDB:', err));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Endpoint de sincronización / registro
app.post('/api/user/sync', async (req, res) => {
  try {
    const { id, first_name, username } = req.body;
    
    if (!id) return res.status(400).json({ error: 'Telegram ID requerido' });

    let user = await User.findOne({ telegramId: id });

    if (!user) {
      user = new User({
        telegramId: id,
        firstName: first_name,
        username: username,
        coins: 100, // Monedas iniciales
        inventory: { coffeeBeans: 0 },
        coffeeCrops: [{ plotId: 1, status: 'empty', plantedAt: null }]
      });
      await user.save();
    } else {
      user.lastLogin = new Date();
      await user.save();
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error('Error en /api/user/sync:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Endpoint para SEMBRAR
app.post('/api/crop/plant', async (req, res) => {
  try {
    const { telegramId, plotId } = req.body;
    const user = await User.findOne({ telegramId });

    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    let crop = user.coffeeCrops.find(c => c.plotId === plotId);
    if (!crop) {
      crop = { plotId, status: 'planted', plantedAt: new Date() };
      user.coffeeCrops.push(crop);
    } else {
      crop.status = 'planted';
      crop.plantedAt = new Date();
    }

    await user.save();
    res.json({ success: true, user });
  } catch (error) {
    console.error('Error al sembrar:', error);
    res.status(500).json({ error: 'Error interno al sembrar' });
  }
});

// Endpoint para COSECHAR
app.post('/api/crop/harvest', async (req, res) => {
  try {
    const { telegramId, plotId } = req.body;
    const user = await User.findOne({ telegramId });

    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    let crop = user.coffeeCrops.find(c => c.plotId === plotId);
    if (crop) {
      crop.status = 'empty';
      crop.plantedAt = null;
if (!user.inventory) user.inventory = { coffeeBeans: 0 };
user.inventory.coffeeBeans = (user.inventory.coffeeBeans || 0) + 10;
      user.coins = (user.coins || 0) + 15;
      await user.save();
      return res.json({ success: true, user });
    }

    res.status(400).json({ error: 'No se encontró la parcela' });
  } catch (error) {
    console.error('Error al cosechar:', error);
    res.status(500).json({ error: 'Error interno al cosechar' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en el puerto ${PORT}`);
});
