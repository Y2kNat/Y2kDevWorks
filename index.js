require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret_change_me';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Y2k2024@';

/* ================= STATUS ================= */

let siteStatus = {
  online: true,
  maintenanceMode: false,
  lastToggle: null
};

/* ================= MEMÓRIA ================= */

let contentStore = {};

/* ================= MIDDLEWARE ================= */

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.static(__dirname));

/* ================= PROTEÇÃO SITE ================= */

app.use((req, res, next) => {
  const url = req.url;

  // 🚨 SEMPRE liberar API
  if (url.startsWith('/api/') || url === '/.well-known/discord') {
    return next();
  }

  // 🚨 SEMPRE liberar admin (EVITA LOCK TOTAL)
  if (url.startsWith('/admin')) {
    return next();
  }

  // arquivos estáticos
  if (
    url.includes('.css') ||
    url.includes('.js') ||
    url.includes('.png') ||
    url.includes('.jpg') ||
    url.includes('.ico')
  ) {
    return next();
  }

  // OFFLINE MODE
  if (!siteStatus.online) {
    return res.sendFile(path.join(__dirname, 'offline.html'));
  }

  // MAINTENANCE MODE
  if (siteStatus.maintenanceMode) {
    return res.sendFile(path.join(__dirname, 'maintenance.html'));
  }

  next();
});

/* ================= ROTAS FRONT ================= */

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/offline', (req, res) => {
  res.sendFile(path.join(__dirname, 'offline.html'));
});

app.get('/maintenance', (req, res) => {
  res.sendFile(path.join(__dirname, 'maintenance.html'));
});

/* ================= DISCORD ENDPOINT ================= */

app.get('/.well-known/discord', (req, res) => {
  res.json({
    status: "ok",
    message: "Discord verification endpoint ativo"
  });
});

/* ================= AUTH ================= */

function authenticateToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido' });
    }

    req.user = user;
    next();
  });
}

/* ================= LOGIN ================= */

app.post('/api/login', async (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Senha necessária' });
  }

  const valid = await bcrypt.compare(
    password,
    await bcrypt.hash(ADMIN_PASSWORD, 10)
  );

  if (!valid) {
    return res.status(401).json({ error: 'Senha incorreta' });
  }

  const token = jwt.sign(
    { user: 'admin' },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    success: true,
    token
  });
});

/* ================= SITE STATUS ================= */

app.get('/api/site-status', (req, res) => {
  res.json(siteStatus);
});

app.post('/api/site-status', authenticateToken, (req, res) => {
  const { online, maintenanceMode } = req.body;

  if (typeof online === 'boolean') {
    siteStatus.online = online;
  }

  if (typeof maintenanceMode === 'boolean') {
    siteStatus.maintenanceMode = maintenanceMode;
  }

  siteStatus.lastToggle = Date.now();

  res.json({
    success: true,
    siteStatus
  });
});

/* ================= CONTENT (MEMÓRIA) ================= */

app.get('/api/content', (req, res) => {
  res.json(contentStore);
});

app.post('/api/save', authenticateToken, (req, res) => {
  contentStore = req.body.content || contentStore;

  res.json({
    success: true,
    message: 'Conteúdo salvo em memória'
  });
});

/* ================= START ================= */

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });
}

module.exports = app;