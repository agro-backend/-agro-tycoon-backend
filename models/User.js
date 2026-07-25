const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  firstName: String,
  username: String,
  coins: { type: Number, default: 100 }, // Saldo inicial
  level: { type: Number, default: 1 },
  coffeeCrops: [
    {
      plotId: Number,
      status: { type: String, default: 'empty' }, // 'empty', 'planted', 'ready'
      plantedAt: Date
    }
  ],
  inventory: {
    coffeeBeans: { type: Number, default: 0 },
    roastedCoffee: { type: Number, default: 0 }
  },
  lastLogin: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
