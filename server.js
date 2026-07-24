const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Conectado a MongoDB Atlas'))
  .catch(err => console.error('❌ Error de conexión:', err));

// Esquema de Usuario directamente en el servidor
const userSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  firstName: String,
  username: String,
  coins: { type: Number, default: 100 },
  level: { type: Number, default: 1 },
  lastLogin: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

app.post('/api/user/sync', async (req, res) => {
  try {
    const { id, first_name, username } = req.body;
    if (!id) return res.status(400).json({ error: 'Telegram ID es requerido' });

    let user = await User.findOne({ telegramId: id });

    if (!user) {
      user = new User({ telegramId: id, firstName: first_name, username: username });
      await user.save();
    } else {
      user.lastLogin = new Date();
      await user.save();
    }

    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`));
