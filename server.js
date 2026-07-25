const express = require('express');
const path = require('path');
const app = express();

// Permite servir el archivo index.html y otros recursos estáticos
app.use(express.static(__dirname));

// Define la ruta principal para entregar index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Ruta alternativa por si Telegram solicita /index.html explícitamente
app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor de Agro-Tycoon corriendo en el puerto ${PORT}`);
});
