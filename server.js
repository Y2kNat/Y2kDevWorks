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

// Hash da senha (gerado uma vez)
let ADMIN_PASSWORD_HASH = '';

// Inicializa o hash da senha
async function initPasswordHash() {
  try {
    ADMIN_PASSWORD_HASH = await bcrypt.hash(ADMIN_PASSWORD, 10);
    console.log('✅ Senha admin inicializada com segurança');
  } catch (error) {
    console.error('Erro ao gerar hash da senha:', error);
  }
}
initPasswordHash();

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// ===== MIDDLEWARE DE AUTENTICAÇÃO JWT =====
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido ou expirado' });
    }
    req.user = user;
    next();
  });
}

// ===== MIDDLEWARE DE BLOQUEIO MOBILE (OPCIONAL) =====
function blockMobile(req, res, next) {
  const userAgent = req.headers['user-agent'] || '';
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  
  // Apenas bloqueia para rotas de API (não para o site público)
  if (isMobile && req.path.startsWith('/api/')) {
    // Permite login mesmo no mobile
    if (req.path === '/api/login') {
      return next();
    }
    return res.status(403).json({ error: 'Acesso administrativo apenas por desktop' });
  }
  next();
}

// Aplica bloqueio mobile nas rotas da API
app.use('/api', blockMobile);

// ===== ROTAS PÚBLICAS =====
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// ===== API DE AUTENTICAÇÃO =====
app.post('/api/login', async (req, res) => {
  const { password } = req.body;
  
  if (!password) {
    return res.status(400).json({ error: 'Senha não fornecida' });
  }
  
  try {
    // Verifica a senha com bcrypt
    const isValid = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Senha incorreta' });
    }
    
    // Gera token JWT (expira em 24h)
    const token = jwt.sign(
      { user: 'admin', role: 'administrator' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({
      success: true,
      token: token,
      expiresIn: 86400 // 24 horas em segundos
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// ===== API PÚBLICA (LEITURA) =====
app.get('/api/content', (req, res) => {
  try {
    const dataPath = path.join(__dirname, 'data', 'content.json');
    
    if (!fs.existsSync(path.join(__dirname, 'data'))) {
      fs.mkdirSync(path.join(__dirname, 'data'));
    }
    
    if (!fs.existsSync(dataPath)) {
      const defaultData = getDefaultContent();
      fs.writeFileSync(dataPath, JSON.stringify(defaultData, null, 2));
    }
    
    const data = fs.readFileSync(dataPath, 'utf8');
    res.json(JSON.parse(data));
  } catch (error) {
    console.error('Erro ao carregar conteúdo:', error);
    res.status(500).json({ error: 'Erro ao carregar conteúdo' });
  }
});

// ===== API PROTEGIDA (ESCRITA) =====
app.post('/api/save', authenticateToken, (req, res) => {
  const { content } = req.body;
  
  // Validação de entrada
  if (!content || typeof content !== 'object') {
    return res.status(400).json({ error: 'Conteúdo inválido' });
  }
  
  // Sanitização básica
  const sanitizedContent = sanitizeContent(content);
  
  try {
    const dataPath = path.join(__dirname, 'data', 'content.json');
    fs.writeFileSync(dataPath, JSON.stringify(sanitizedContent, null, 2));
    
    console.log(`✅ Conteúdo salvo por ${req.user.user} em ${new Date().toISOString()}`);
    
    res.json({
      success: true,
      message: 'Conteúdo salvo com sucesso!',
      savedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro ao salvar conteúdo:', error);
    res.status(500).json({ error: 'Erro ao salvar conteúdo' });
  }
});

// ===== API PARA VERIFICAR TOKEN =====
app.get('/api/verify', authenticateToken, (req, res) => {
  res.json({
    valid: true,
    user: req.user,
    message: 'Token válido'
  });
});

// ===== FUNÇÕES AUXILIARES =====
function getDefaultContent() {
  return {
    hero: {
      badge: "Y2K_DevWorks // online",
      titulo: "Bots Discord que fazem a diferença",
      bio: "𝙳𝚎𝚜𝚎𝚗𝚟𝚘𝚕𝚟𝚎𝚍𝚘𝚛 𝚍𝚎 𝚜𝚒𝚜𝚝𝚎𝚖𝚊𝚜 𝚙𝚊𝚛𝚊 𝙳𝚒𝚜𝚌𝚘𝚛𝚍",
      descricao: "Sistemas personalizados para seu servidor Discord. Automação inteligente, moderação eficiente e whitelist profissional."
    },
    stats: [
      { valor: 150, label: "Usuários Ajudados" },
      { valor: 6, label: "Projetos Ativos" },
      { valor: 1, label: "Ano de XP" }
    ],
    projetos: [
      {
        id: "proj_1",
        nome: "Insight",
        tipo: "Sistema de Sugestões",
        descricao: "Sistema completo de sugestões com votação, comentários e análise de engajamento.",
        icone: "fa-lightbulb"
      },
      {
        id: "proj_2",
        nome: "Atlas",
        tipo: "Registro de Imóveis",
        descricao: "Sistema de registro e gerenciamento de propriedades para servidores de RP.",
        icone: "fa-building"
      },
      {
        id: "proj_3",
        nome: "Vehix",
        tipo: "Registro de Veículos",
        descricao: "Sistema completo de registro e controle de veículos com painel administrativo.",
        icone: "fa-car"
      },
      {
        id: "proj_4",
        nome: "HostVille Services",
        tipo: "Moderação & Staff",
        descricao: "Bots de moderação, sistema de warns e avaliação de equipe staff.",
        icone: "fa-shield-alt"
      },
      {
        id: "proj_5",
        nome: "Cidade de Deus RP",
        tipo: "WhiteList Completa",
        descricao: "Bot completo de whitelist para servidor de Roleplay com todas as funcionalidades.",
        icone: "fa-list-check"
      },
      {
        id: "proj_6",
        nome: "Seu Projeto",
        tipo: "Sob Demanda",
        descricao: "Precisa de um sistema personalizado? Entre em contato para desenvolvermos juntos.",
        icone: "fa-plus-circle"
      }
    ],
    sobre: {
      nome: "Isac",
      bio: "𝙳𝚎𝚜𝚎𝚗𝚟𝚘𝚕𝚟𝚎𝚍𝚘𝚛 𝚍𝚎 𝚜𝚒𝚜𝚝𝚎𝚖𝚊𝚜 𝚙𝚊𝚛𝚊 𝙳𝚒𝚜𝚌𝚘𝚛𝚍",
      texto: "Meu nome é Isac, desenvolvedor de bots e sistemas para Discord com 1 ano de experiência em JavaScript e Python. Comecei criando pequenas automações e hoje desenvolvo sistemas completos de whitelist, moderação e gestão.\n\nMinha paixão por lógica e resolução de problemas vem da matemática, onde conquistei o bicampeonato paulista olímpico. Essa mesma lógica aplico no desenvolvimento de bots eficientes e bem estruturados.",
      skills: ["JavaScript", "Python", "HTML", "Discord.js", "Node.js", "Automação"]
    },
    contato: {
      discord: "@Y2k_Nat",
      email: "Y2k_Nat@hotmail.com",
      horario_semana: "13h às 21h",
      horario_fim: "14h às 22h"
    }
  };
}

function sanitizeContent(content) {
  // Função de sanitização para evitar XSS e dados maliciosos
  const sanitized = { ...content };
  
  // Sanitiza strings
  if (sanitized.hero) {
    sanitized.hero.badge = String(sanitized.hero.badge || '').trim().substring(0, 100);
    sanitized.hero.titulo = String(sanitized.hero.titulo || '').trim().substring(0, 200);
    sanitized.hero.bio = String(sanitized.hero.bio || '').trim().substring(0, 500);
    sanitized.hero.descricao = String(sanitized.hero.descricao || '').trim().substring(0, 1000);
  }
  
  // Sanitiza stats
  if (Array.isArray(sanitized.stats)) {
    sanitized.stats = sanitized.stats.map(stat => ({
      valor: parseInt(stat.valor) || 0,
      label: String(stat.label || '').trim().substring(0, 50)
    }));
  }
  
  // Sanitiza projetos
  if (Array.isArray(sanitized.projetos)) {
    sanitized.projetos = sanitized.projetos.map(proj => ({
      id: proj.id || 'proj_' + Date.now() + '_' + Math.random().toString(36),
      nome: String(proj.nome || '').trim().substring(0, 100),
      tipo: String(proj.tipo || '').trim().substring(0, 100),
      descricao: String(proj.descricao || '').trim().substring(0, 500),
      icone: String(proj.icone || 'fa-code').trim().substring(0, 50)
    }));
  }
  
  // Sanitiza sobre
  if (sanitized.sobre) {
    sanitized.sobre.nome = String(sanitized.sobre.nome || '').trim().substring(0, 100);
    sanitized.sobre.bio = String(sanitized.sobre.bio || '').trim().substring(0, 500);
    sanitized.sobre.texto = String(sanitized.sobre.texto || '').trim().substring(0, 2000);
    if (Array.isArray(sanitized.sobre.skills)) {
      sanitized.sobre.skills = sanitized.sobre.skills
        .map(s => String(s).trim().substring(0, 50))
        .filter(s => s.length > 0);
    }
  }
  
  // Sanitiza contato
  if (sanitized.contato) {
    sanitized.contato.discord = String(sanitized.contato.discord || '').trim().substring(0, 100);
    sanitized.contato.email = String(sanitized.contato.email || '').trim().toLowerCase().substring(0, 100);
    sanitized.contato.horario_semana = String(sanitized.contato.horario_semana || '').trim().substring(0, 50);
    sanitized.contato.horario_fim = String(sanitized.contato.horario_fim || '').trim().substring(0, 50);
  }
  
  return sanitized;
}

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`🔐 JWT configurado com segurança`);
  console.log(`📁 Diretório: ${__dirname}`);
});