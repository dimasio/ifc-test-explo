# IFC Viewer MVP

Приложение для просмотра IFC-моделей с извлечением конструктивных элементов и подложек.

## Архитектура

Проект состоит из:
- `src/server.js` — Express-сервер для API и раздачи статики
- `public/` — статический фронтенд (index.html, app.js, worker.mjs)
- `scripts/convert.js` — скрипт конвертации IFC в Fragments формат
- `src/lib/ifcExtractor.js` — модуль для извлечения данных из IFC-файлов

## Установка

```bash
npm install
```

## Запуск сервера

```bash
npm start
```

Сервер запустится на `http://localhost:3000`

## Эндпоинты API

### `GET /health` — Health check
Проверка работоспособности сервера.

**Ответ:**
```json
{
  "ok": true
}
```

### `GET /` — Главная страница
Отдаёт `public/index.html`

### `GET /app.js` — Фронтенд-скрипт
Отдаёт `public/app.js`

### `GET /worker.mjs` — Web Worker
Отдаёт `public/worker.mjs` с правильным Content-Type

### `POST /api/upload` — Загрузка IFC-файла
Загружает IFC-файл и извлекает данные.

**Тело запроса:** файл (multipart/form-data)

**Ответ:**
```json
{
  "success": true,
  "fileName": "model_1781869108512.ifc",
  "fileSize": 123456
}
```

### `GET /api/model/data` — Список элементов (с пагинацией)
**Параметры:**
- `page` — номер страницы (по умолчанию: 1)
- `pageSize` — размер страницы (по умолчанию: 50, максимум: 1000)

**Ответ:**
```json
{
  "allElements": [...],
  "total": 100,
  "page": 1,
  "pageSize": 50,
  "totalPages": 2
}
```

### `GET /api/model/all-data` — Все элементы
**Ответ:**
```json
{
  "allElements": [...]
}
```

### `GET /api/model/file` — Последний загруженный IFC-файл
Возвращает файл из папки `uploads/`

### `GET /api/model/fragments` — Геометрия (.frag файл)
Возвращает `public/model.frag` если существует

### `GET /api/model/properties` — Свойства (.json файл)
Возвращает `public/properties.json` если существует

### `POST /api/convert` — Конвертация в Fragments
Конвертирует IFC-файл в Fragments формат.

**Тело запроса:**
```json
{
  "ifcFilePath": "uploads/model_1781855600689.ifc"
}
```

## Конвертация IFC в Fragments

Для конвертации IFC-файла в Fragments формат используйте скрипт `scripts/convert.js`:

```bash
node scripts/convert.js path/to/file.ifc
```

Скрипт создаст два артефакта в папке `public/`:
- `model.frag` — бинарный файл с геометрией
- `properties.json` — JSON файл со свойствами элементов

## Структура проекта

```
ifcMVP/
├── scripts/
│   └── convert.js          # Конвертация IFC → Fragments
├── src/
│   ├── server.js           # Express-сервер
│   └── lib/
│       └── ifcExtractor.js # Извлечение данных из IFC
├── public/                 # Статический фронтенд
│   ├── index.html
│   ├── app.js
│   └── worker.mjs
├── uploads/                # Загруженные IFC-файлы (авто-создается)
├── package.json
└── README.md
```

## Типы элементов

### Конструктивные элементы
- `IfcWall` — стены
- `IfcSlab` — перекрытия
- `IfcBeam` — балки
- `IfcColumn` — колонны

### Подложки
- `IfcGrid` — сетки осей

## Артефакты конвертации

Скрипт `convert.js` создает:
- `public/model.frag` — бинарный файл с геометрией
- `public/properties.json` — JSON файл со свойствами

Загруженные IFC-файлы сохраняются в `uploads/`.