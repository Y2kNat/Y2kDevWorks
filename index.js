require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret_change_me';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Y2k2024@';

let siteStatus = {
  online: true,
  maintenanceMode: false,
  lastToggle: null
};

let ADMIN_PASSWORD_HASH = '';

async function initPasswordHash() {
  ADMIN_PASSWORD_HASH = await bcrypt.hash(ADMIN_PASSWORD, 10);
}

initPasswordHash();

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.static(__dirname));

/* ================= STATUS ================= */

app.use((req, res, next) => {
  const url = req.url;

  if (
    url.includes('/api/') ||
    url.includes('.css') ||
    url.includes('.js') ||
    url.includes('.png') ||
    url.includes('.jpg') ||
    url.includes('.ico')
  ) {
    return next();
  }

  if (!siteStatus.online) {
    return res.sendFile(path.join(__dirname, 'offline.html'));
  }

  if (siteStatus.maintenanceMode) {
    return res.sendFile(path.join(__dirname, 'maintenance.html'));
  }

  next();
});

/* ================= ROTAS ================= */

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

/* ================= AUTH ================= */

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'Token não fornecido'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        error: 'Token inválido'
      });
    }

    req.user = user;
    next();
  });
}

app.post('/api/login', async (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({
      error: 'Senha necessária'
    });
  }

  const valid = await bcrypt.compare(
    password,
    ADMIN_PASSWORD_HASH
  );

  if (!valid) {
    return res.status(401).json({
      error: 'Senha incorreta'
    });
  }

  const token = jwt.sign(
    {
      user: 'admin'
    },
    JWT_SECRET,
    {
      expiresIn: '24h'
    }
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

  if (online !== undefined) {
    siteStatus.online = online;
  }

  if (maintenanceMode !== undefined) {
    siteStatus.maintenanceMode = maintenanceMode;
  }

  siteStatus.lastToggle = Date.now();

  res.json({
    success: true,
    siteStatus
  });
});

/* ================= CONTENT ================= */

app.get('/api/content', (req, res) => {
  try {
    const file = path.join(
      __dirname,
      'data',
      'content.json'
    );

    if (!fs.existsSync(file)) {
      return res.json({});
    }

    const content = JSON.parse(
      fs.readFileSync(file, 'utf8')
    );

    res.json(content);
  } catch (err) {
    res.status(500).json({
      error: 'Erro ao carregar conteúdo'
    });
  }
});

app.post('/api/save', authenticateToken, (req, res) => {
  try {
    const file = path.join(
      __dirname,
      'data',
      'content.json'
    );

    fs.writeFileSync(
      file,
      JSON.stringify(req.body.content, null, 2)
    );

    res.json({
      success: true
    });
  } catch (err) {
    res.status(500).json({
      error: 'Erro ao salvar'
    });
  }
});

/* ================= START ================= */

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});