const express = require('express');
const cors = require('cors');
require('dotenv').config();
const serverless = require('serverless-http'); // ✅ Eklendi

const { db, admin } = require('../src/config/firebase'); // api klasöründen çıkınca yol değişti

const authRoutes = require('../src/routes/auth');
const driverRoutes = require('../src/routes/drivers');
const marketRoutes = require('../src/routes/markets');
const customFieldRoutes = require('../src/routes/customFields');
const routingRoutes = require('../src/routes/routing');
const seedRoutes = require('../src/routes/seed');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Rotalar
app.use('/api/auth', authRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/markets', marketRoutes);
app.use('/api/custom-fields', customFieldRoutes);
app.use('/api/routing', routingRoutes);
app.use('/api/seed', seedRoutes);

// Config endpoint
app.get('/api/config', (req, res) => {
  res.json({
    hereApiKey: process.env.HERE_API_KEY,
    firebaseApiKey: process.env.FIREBASE_WEB_API_KEY
  });
});

// Hata yakalama
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: "Sunucuda beklenmedik bir hata oluştu.",
    error: err.message
  });
});

// ✅ Vercel uyumlu export
module.exports = app;
module.exports.handler = serverless(app);
