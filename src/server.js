import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, existsSync, readFileSync } from 'fs';
import multer from 'multer';
import { extractIfc } from './lib/ifcExtractor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const UPLOADS_DIR = join(__dirname, '../uploads');
mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
  dest: UPLOADS_DIR,
  limits: {
    fileSize: 200 * 1024 * 1024 // 200MB limit
  },
  filename: (req, file, cb) => {
    cb(null, `model_${Date.now()}.ifc`);
  }
});

let lastUploadedFile = null;
let lastFragFile = null;

let cachedElements = null;
let cachedElementsCount = 0;

async function loadPropertiesFromJson() {
  const propertiesPath = join(__dirname, '../public/properties.json');
  
  if (!existsSync(propertiesPath)) {
    return false;
  }
  
  try {
    const fileContent = readFileSync(propertiesPath, 'utf8');
    const propertiesData = JSON.parse(fileContent);
    
    cachedElements = propertiesData;
    cachedElementsCount = propertiesData.length;
    
    return true;
  } catch (e) {
    return false;
  }
}

async function loadPropertiesFromFrag() {
  const fragPath = join(__dirname, '../public/model.frag');
  
  if (!existsSync(fragPath)) {
    return false;
  }
  
  return true;
}

app.use(express.json({ limit: '200mb', strict: false }));
app.use(express.static(join(__dirname, '../public')));
app.use('/node_modules/', express.static(join(__dirname, '../node_modules')));

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, '../public/index.html'));
});

// POST /api/upload - сохраняет файл без конвертации
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Файл не был загружен' });
      return;
    }

    lastUploadedFile = req.file.filename;

    res.json({ 
      success: true,
      fileName: req.file.filename,
      fileSize: req.file.size
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Ошибка при обработке файла',
      details: error.message 
    });
  }
});

app.get('/api/model/file', (req, res) => {
  if (!lastUploadedFile) {
    res.status(404).json({ error: 'Файл не загружен' });
    return;
  }
  
  const filePath = join(UPLOADS_DIR, lastUploadedFile);
  res.sendFile(filePath);
});

app.get('/api/model/data', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  let pageSize = req.query.pageSize;
  
  if (pageSize) {
    pageSize = parseInt(pageSize);
    if (isNaN(pageSize) || pageSize <= 0) pageSize = 50;
    if (pageSize > 1000) pageSize = 1000;
  } else {
    pageSize = 50;
  }
  
  if (!cachedElements) {
    res.json({ 
      allElements: [], 
      total: 0, 
      page, 
      pageSize,
      totalPages: 0
    });
    return;
  }
  
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const paginatedElements = cachedElements.slice(start, end);
  const totalPages = Math.ceil(cachedElementsCount / pageSize);

  res.json({ 
    allElements: paginatedElements,
    total: cachedElementsCount,
    page,
    pageSize,
    totalPages
  });
});

app.get('/api/model/all-data', (req, res) => {
  if (!cachedElements) {
    res.json({ allElements: [] });
    return;
  }
  
  res.json({ allElements: cachedElements });
});

app.get('/api/model/fragments', (req, res) => {
  const filePath = join(__dirname, '../public/model.frag');
  if (existsSync(filePath)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'Файл фрагментов не найден' });
  }
});

app.get('/api/model/properties', (req, res) => {
  const filePath = join(__dirname, '../public/properties.json');
  if (existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'Файл свойств не найден' });
  }
});

app.post('/api/convert', async (req, res) => {
  try {
    const { ifcFilePath } = req.body;
    
    if (!ifcFilePath) {
      res.status(400).json({ error: 'Не указан путь к IFC файлу' });
      return;
    }
    
    const fullPath = join(__dirname, '../', ifcFilePath);
    
    if (!existsSync(fullPath)) {
      res.status(404).json({ error: 'IFC файл не найден' });
      return;
    }
    
    const { exec } = await import('child_process');
    const command = `node scripts/convert.js "${ifcFilePath}"`;
    
    exec(command, { cwd: join(__dirname, '..') }, (error, stdout, stderr) => {
      if (error) {
        res.status(500).json({ 
          error: 'Ошибка конвертации',
          details: error.message,
          stdout,
          stderr
        });
        return;
      }
      
      lastFragFile = 'model.frag';
      
      res.json({ 
        success: true,
        message: 'Конвертация завершена',
        stdout,
        stderr
      });
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Ошибка конвертации',
      details: error.message 
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Страница не найдена' });
});

app.use((err, req, res, next) => {
  res.status(500).json({ 
    error: 'Внутренняя ошибка сервера',
    details: process.env.NODE_ENV === 'production' ? undefined : err.message 
  });
});

let server = null;

function gracefulShutdown() {
  if (server) {
    server.close(() => {
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

server = app.listen(PORT, () => {});