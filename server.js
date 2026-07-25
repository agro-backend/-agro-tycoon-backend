const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
app.use(express.json());
app.use(cors());

// Configuración de variables de entorno
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
const BOT_TOKEN = process.env.BOT_TOKEN;

// Inicialización del Bot de Telegram (si se proporciona token)
let bot;
if (BOT_TOKEN) {
  bot = new TelegramBot(BOT_TOKEN, { polling: false });
}

// Conexión a MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log('Conectado con éxito a MongoDB'))
  .catch(err => console.error('Error al conectar a MongoDB:', err));

// ==========================================
// MODELOS DE BASE DE DATOS
// ==========================================

const UserSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  firstName: String,
  coins: { type: Number, default: 100 },
  inventory: {
    cafeVerde: { type: Number, default: 0 },
    cafeProcesado: { type: Number, default: 0 }
  },
  // Nuevos campos para referidos
  referredBy: { type: String, default: null },
  referralsCount: { type: Number, default: 0 }
});


const P2POrderSchema = new mongoose.Schema({
  sellerId: { type: String, required: true },
  itemType: { type: String, required: true }, // 'cafeVerde' o 'cafeProcesado'
  quantity: { type: Number, required: true },
  totalPrice: { type: Number, required: true },
  status: { type: String, default: 'active' }, // 'active', 'sold', 'cancelled'
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const P2POrder = mongoose.model('P2POrder', P2POrderSchema);

// ==========================================
// ENDPOINTS DEL JUEGO
// ==========================================

// Autenticación o inicio de usuario
app.post('/api/user/start', async (req, res) => {
  const { id, firstName } = req.body;
  try {
    let user = await User.findOne({ telegramId: id.toString() });
    if (!user) {
      user = new User({
        telegramId: id.toString(),
        firstName: firstName || 'Agricultor'
      });
      await user.save();
    }
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: 'Error al iniciar usuario' });
  }
});

// Endpoint para Sembrar
app.post('/api/user/plant', async (req, res) => {
  const { id } = req.body;
  try {
    const user = await User.findOne({ telegramId: id.toString() });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: 'Error al sembrar' });
  }
});

// Endpoint para Cosechar
app.post('/api/user/harvest', async (req, res) => {
  const { id } = req.body;
  try {
    const user = await User.findOne({ telegramId: id.toString() });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (!user.inventory) {
      user.inventory = { cafeVerde: 0, cafeProcesado: 0 };
    }

    // Se otorgan 10 kg de café verde por cosecha
    user.inventory.cafeVerde = (user.inventory.cafeVerde || 0) + 10;
    await user.save();

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: 'Error al cosechar' });
  }
});

// Endpoint para Procesar / Tostar Café
app.post('/api/factory/roast', async (req, res) => {
  const { id } = req.body;
  try {
    const user = await User.findOne({ telegramId: id.toString() });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (!user.inventory || user.inventory.cafeVerde < 10) {
      return res.status(400).json({ error: 'Necesitas al menos 10 kg de café verde' });
    }

    user.inventory.cafeVerde -= 10;
    user.inventory.cafeProcesado = (user.inventory.cafeProcesado || 0) + 10;
    await user.save();

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: 'Error al procesar café' });
  }
});

// Endpoint para Comprar Semillas
app.post('/api/shop/buy-seeds', async (req, res) => {
  const { id } = req.body;
  try {
    const user = await User.findOne({ telegramId: id.toString() });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (user.coins < 20) {
      return res.status(400).json({ error: 'Monedas insuficientes' });
    }

    user.coins -= 20;
    await user.save();

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: 'Error al comprar semillas' });
  }
});

// ==========================================
// ENDPOINTS MERCADO P2P
// ==========================================

// Crear Oferta P2P
app.post('/api/p2p/sell', async (req, res) => {
  const { id, itemType, quantity, totalPrice } = req.body;
  try {
    const user = await User.findOne({ telegramId: id.toString() });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (!user.inventory || (user.inventory[itemType] || 0) < quantity) {
      return res.status(400).json({ error: 'No tienes suficiente cantidad en el inventario.' });
    }

    // Descontar del inventario y guardar oferta
    user.inventory[itemType] -= quantity;
    await user.save();

    const order = new P2POrder({
      sellerId: user.telegramId,
      itemType,
      quantity,
      totalPrice
    });
    await order.save();

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear la oferta P2P' });
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

// Comprar Oferta P2P (con notificación al vendedor)
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
    if (!buyer.inventory) buyer.inventory = { cafeVerde: 0, cafeProcesado: 0 };
    buyer.inventory[order.itemType] = (buyer.inventory[order.itemType] || 0) + order.quantity;

    if (seller) {
      const earnings = Math.floor(order.totalPrice * 0.95);
      seller.coins += earnings;
      await seller.save();

      // Notificar al vendedor que se realizó una venta
      if (BOT_TOKEN && bot) {
                await bot.sendMessage(
          seller.telegramId,
          `💰 *¡Venta Realizada!* ${buyer.firstName} ha comprado tu oferta de *${order.quantity}* de café. Has recibido ${earnings} monedas.`,
          { parse_mode: 'Markdown' }
        );

        } catch (e) {
          console.error('Error enviando notificación de venta:', e.message);
        }
      }
    }

    order.status = 'sold';
    await order.save();
    await buyer.save();

    res.json({ success: true, user: buyer });
  } catch (err) {
    res.status(500).json({ error: 'Error en la compra P2P' });
  }
});

// ==========================================
// ENDPOINTS DE INVENTARIO
// ==========================================

// Obtener inventario del usuario por telegramId
app.get('/api/inventory/:telegramId', async (req, res) => {
  try {
    const { telegramId } = req.params;
    const user = await User.findOne({ telegramId });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({
      coins: user.coins || 0,
      cafeVerde: user.inventory?.cafeVerde || 0,
      cafeProcesado: user.inventory?.cafeProcesado || 0
    });
  } catch (error) {
    console.error('Error al obtener inventario:', error);
    res.status(500).json({ error: 'Error al consultar el inventario' });
  }
});

// Arrancar el Servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
