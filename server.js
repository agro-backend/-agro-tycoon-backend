const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());

// Servir la interfaz web (index.html)
app.use(express.static(path.join(__dirname)));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Conexión a MongoDB Atlas
const MONGO_URI = process.env.MONGO_URI;
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Conectado exitosamente a MongoDB Atlas'))
  .catch(err => console.error('❌ Error al conectar a MongoDB:', err));

// 1. ESQUEMA DE USUARIO
const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  firstName: { type: String, default: 'Agricultor' },
  coins: { type: Number, default: 200 },
  
  inventory: {
    seeds: { type: Number, default: 5 },
    greenCoffee: { type: Number, default: 0 },
    roastedCoffee: { type: Number, default: 0 }
  },

  coffeeCrops: [{
    plotId: Number,
    status: { type: String, default: 'empty' },
    plantedAt: Date
  }],

  factory: {
    roaster: {
      unlocked: { type: Boolean, default: true },
      status: { type: String, default: 'idle' }
    }
  }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// 2. ESQUEMA MERCADO P2P
const p2pOrderSchema = new mongoose.Schema({
  sellerId: { type: String, required: true },
  sellerName: { type: String, default: 'Anónimo' },
  itemType: { type: String, enum: ['greenCoffee', 'roastedCoffee'], required: true },
  quantity: { type: Number, required: true, min: 1 },
  pricePerUnit: { type: Number, required: true, min: 1 },
  totalPrice: { type: Number, required: true },
  status: { type: String, enum: ['active', 'sold'], default: 'active' }
}, { timestamps: true });

const P2POrder = mongoose.model('P2POrder', p2pOrderSchema);

// --- RUTAS API ---

// Sincronización inicial
app.post('/api/user/sync', async (req, res) => {
  const { id, first_name } = req.body;
  if (!id) return res.status(400).json({ error: 'Falta Telegram ID' });

  try {
    let user = await User.findOne({ telegramId: id.toString() });
    if (!user) {
      user = new User({
        telegramId: id.toString(),
        firstName: first_name || 'Agricultor',
        coffeeCrops: [{ plotId: 1, status: 'empty' }]
      });
      await user.save();
    }
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: 'Error en sync' });
  }
});

// Sembrar
app.post('/api/user/plant', async (req, res) => {
  const { id, plotId } = req.body;
  try {
    const user = await User.findOne({ telegramId: id.toString() });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    if ((user.inventory.seeds || 0) < 1) {
      return res.status(400).json({ error: 'No tienes semillas suficientes. Cómpralas en el mercado.' });
    }

    let crop = user.coffeeCrops.find(c => c.plotId === (plotId || 1));
    if (!crop) {
      crop = { plotId: plotId || 1, status: 'empty' };
      user.coffeeCrops.push(crop);
    }

    if (crop.status === 'planted') {
      return res.status(400).json({ error: 'Esta parcela ya está sembrada.' });
    }

    user.inventory.seeds -= 1;
    crop.status = 'planted';
    crop.plantedAt = new Date();
    await user.save();

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: 'Error al sembrar' });
  }
});

// Cosechar
app.post('/api/user/harvest', async (req, res) => {
  const { id, plotId } = req.body;
  try {
    const user = await User.findOne({ telegramId: id.toString() });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const crop = user.coffeeCrops.find(c => c.plotId === (plotId || 1));
    if (!crop || crop.status !== 'planted') {
      return res.status(400).json({ error: 'No hay cultivo para cosechar.' });
    }

    const elapsedSeconds = (new Date() - new Date(crop.plantedAt)) / 1000;
    if (elapsedSeconds < 60) {
      return res.status(400).json({ error: 'El cultivo aún no está listo.' });
    }

    crop.status = 'empty';
    crop.plantedAt = null;
    user.inventory.greenCoffee = (user.inventory.greenCoffee || 0) + 1;
    await user.save();

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: 'Error al cosechar' });
  }
});

// Tostar Café en la Fábrica
app.post('/api/factory/roast', async (req, res) => {
  const { id } = req.body;
  try {
    const user = await User.findOne({ telegramId: id.toString() });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    if ((user.inventory.greenCoffee || 0) < 2) {
      return res.status(400).json({ error: 'Necesitas al menos 2 granos verdes para tostar.' });
    }

    user.inventory.greenCoffee -= 2;
    user.inventory.roastedCoffee = (user.inventory.roastedCoffee || 0) + 2;
    await user.save();

    res.json({ success: true, message: '¡Café tostado con éxito!', user });
  } catch (err) {
    res.status(500).json({ error: 'Error al tostar café' });
  }
});

// Comprar Semillas en la Tienda
app.post('/api/shop/buy-seeds', async (req, res) => {
  const { id } = req.body;
  const SEED_PRICE = 10;
  try {
    const user = await User.findOne({ telegramId: id.toString() });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (user.coins < SEED_PRICE) {
      return res.status(400).json({ error: 'Monedas insuficientes (Cuestan 10 🪙).' });
    }

    user.coins -= SEED_PRICE;
    user.inventory.seeds = (user.inventory.seeds || 0) + 1;
    await user.save();

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: 'Error al comprar semillas' });
  }
});

// Crear Oferta P2P
app.post('/api/p2p/create', async (req, res) => {
  const { id, itemType, quantity, pricePerUnit } = req.body;
  const qty = parseInt(quantity);
  const price = parseInt(pricePerUnit);

  try {
    const user = await User.findOne({ telegramId: id.toString() });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    if ((user.inventory[itemType] || 0) < qty) {
      return res.status(400).json({ error: 'No tienes suficiente cantidad de este producto.' });
    }

    user.inventory[itemType] -= qty;
    await user.save();

    const order = new P2POrder({
      sellerId: user.telegramId,
      sellerName: user.firstName,
      itemType,
      quantity: qty,
      pricePerUnit: price,
      totalPrice: qty * price
    });
    await order.save();

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear la oferta' });
  }
});

// Listar Ofertas P2P
app.get('/api/p2p/orders', async (req, res) => {
  try {
    const orders = await P2POrder.find({ status: 'active' }).sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ error: 'Error al cargar el mercado' });
  }
});

// Comprar Oferta P2P
app.post('/api/p2p/buy', async (req, res) => {
  const { id, orderId } = req.body;
  try {
    const buyer = await User.findOne({ telegramId: id.toString() });
    const order = await P2POrder.findById(orderId);

    if (!order || order.status !== 'active') {
      return res.status(400).json({ error: 'La oferta ya no está disponible.' });
    }
    if (order.sellerId === buyer.telegramId) {
      return res.status(400).json({ error: 'No puedes comprar tu propia oferta.' });
    }
    if (buyer.coins < order.totalPrice) {
      return res.status(400).json({ error: 'Monedas insuficientes.' });
    }

    const seller = await User.findOne({ telegramId: order.sellerId });

    buyer.coins -= order.totalPrice;
    buyer.inventory[order.itemType] = (buyer.inventory[order.itemType] || 0) + order.quantity;

    if (seller) {
      const earnings = Math.floor(order.totalPrice * 0.95);
      seller.coins += earnings;
      await seller.save();
    }

    order.status = 'sold';
    await order.save();
    await buyer.save();

    res.json({ success: true, user: buyer });
  } catch (err) {
    res.status(500).json({ error: 'Error en la compra P2P' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en el puerto ${PORT}`);
});


