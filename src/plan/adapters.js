/**
 * Адаптеры для интеграции с 2D Canvas
 * @module src/plan/adapters
 */

/**
 * Canvas адаптер для отрисовки элементов 2D плана
 * Реализует интерфейс рендеринга через HTML5 Canvas API
 */
export class CanvasAdapter {
  constructor() {
    this.ctx = null;
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
  }

  /**
   * Инициализирует контекст Canvas
   * @param {HTMLCanvasElement} canvas - Canvas элемент
   */
  init(canvas) {
    if (!canvas) {
      throw new Error('Canvas element required');
    }
    this.ctx = canvas.getContext('2d');
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
  }

  /**
   * Устанавливает масштаб и смещение
   * @param {number} scale - Масштаб (1 = 1:1)
   * @param {number} offsetX - Смещение по X
   * @param {number} offsetY - Смещение по Y
   */
  setTransform(scale, offsetX, offsetY) {
    this.scale = scale;
    this.offsetX = offsetX;
    this.offsetY = offsetY;
  }

  /**
   * Преобразует 2D элементы для отрисовки на Canvas
   * @param {Array} planElements - Элементы 2D плана
   * @returns {Array} Элементы с рассчитанными Canvas координатами
   */
  toCanvas(planElements) {
    return planElements.map(element => {
      const canvasX = (element.position?.x || 0) * this.scale + this.offsetX;
      const canvasY = (element.position?.y || 0) * this.scale + this.offsetY;
      
      return {
        ...element,
        canvasX,
        canvasY,
        canvasWidth: (element.dimensions?.width || element.geometry?.width || 100) * this.scale,
        canvasHeight: (element.dimensions?.length || element.geometry?.height || 100) * this.scale
      };
    });
  }

  /**
   * Рисует один элемент
   * @param {Object} element - Элемент с canvas координатами
   */
  drawElement(element) {
    if (!this.ctx) {
      return;
    }

    const x = element.canvasX;
    const y = element.canvasY;
    const w = element.canvasWidth;
    const h = element.canvasHeight;

    this.ctx.save();
    
    // Настраиваем стили в зависимости от типа элемента
    this._configureStyle(element);
    
    // Рисуем в зависимости от типа геометрии
    if (element.type === 'wall' || element.type === 'floor') {
      this._drawRect(element, x, y, w, h);
    } else if (element.type === 'door') {
      this._drawDoor(element, x, y, w, h);
    } else if (element.type === 'window') {
      this._drawWindow(element, x, y, w, h);
    } else if (element.type === 'furniture') {
      this._drawFurniture(element, x, y, w, h);
    } else {
      this._drawRect(element, x, y, w, h);
    }
    
    this.ctx.restore();
  }

  /**
   * Рисует прямоугольник
   * @param {Object} element - Элемент
   * @param {number} x - X координата
   * @param {number} y - Y координата
   * @param {number} w - Ширина
   * @param {number} h - Высота
   */
  _drawRect(element, x, y, w, h) {
    if (!this.ctx) return;

    // Фон
    this.ctx.fillStyle = this._getColor(element.type, 'fill');
    this.ctx.fillRect(x, y, w, h);
    
    // Обводка
    this.ctx.strokeStyle = this._getColor(element.type, 'stroke');
    this.ctx.lineWidth = this._getLineWidth(element.type);
    this.ctx.strokeRect(x, y, w, h);
    
    // Текст (имя элемента)
    if (element.name) {
      this.ctx.fillStyle = '#000000';
      this.ctx.font = '12px Arial';
      this.ctx.fillText(element.name, x + 5, y + 15);
    }
  }

  /**
   * Рисует дверь
   * @param {Object} element - Элемент
   * @param {number} x - X координата
   * @param {number} y - Y координата
   * @param {number} w - Ширина
   * @param {number} h - Высота
   */
  _drawDoor(element, x, y, w, h) {
    if (!this.ctx) return;

    const rotation = element.rotation || 0;
    
    // Основной контур
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(x, y, w, h);
    
    // Обводка
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x, y, w, h);
    
    // Дуга открывания двери
    this.ctx.beginPath();
    this.ctx.strokeStyle = '#ff6600';
    this.ctx.lineWidth = 1;
    
    const arcRadius = Math.min(w, h) * 0.5;
    const startAngle = (rotation * Math.PI) / 180;
    const endAngle = startAngle + (90 * Math.PI) / 180;
    
    this.ctx.arc(x + w, y + h, arcRadius, startAngle, endAngle, false);
    this.ctx.stroke();
    
    // Текст
    if (element.name) {
      this.ctx.fillStyle = '#000000';
      this.ctx.font = '10px Arial';
      this.ctx.fillText('Дверь', x + 5, y + 10);
    }
  }

  /**
   * Рисует окно
   * @param {Object} element - Элемент
   * @param {number} x - X координата
   * @param {number} y - Y координата
   * @param {number} w - Ширина
   * @param {number} h - Высота
   */
  _drawWindow(element, x, y, w, h) {
    if (!this.ctx) return;

    // Основной контур
    this.ctx.fillStyle = '#e0f7fa';
    this.ctx.fillRect(x, y, w, h);
    
    // Обводка
    this.ctx.strokeStyle = '#006064';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x, y, w, h);
    
    // Поперечная линия (представляет стекло)
    this.ctx.beginPath();
    this.ctx.strokeStyle = '#b2ebf2';
    this.ctx.lineWidth = 1;
    this.ctx.moveTo(x, y + h / 2);
    this.ctx.lineTo(x + w, y + h / 2);
    this.ctx.stroke();
    
    // Текст
    if (element.name) {
      this.ctx.fillStyle = '#000000';
      this.ctx.font = '10px Arial';
      this.ctx.fillText('Окно', x + 5, y + 10);
    }
  }

  /**
   * Рисует мебель
   * @param {Object} element - Элемент
   * @param {number} x - X координата
   * @param {number} y - Y координата
   * @param {number} w - Ширина
   * @param {number} h - Высота
   */
  _drawFurniture(element, x, y, w, h) {
    if (!this.ctx) return;

    // Основной контур (пунктир для мебели)
    this.ctx.setLineDash([5, 3]);
    this.ctx.strokeStyle = '#757575';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x, y, w, h);
    
    // Заливка
    this.ctx.fillStyle = '#bdbdbd';
    this.ctx.fillRect(x, y, w, h);
    
    this.ctx.setLineDash([]);
    
    // Текст
    if (element.name) {
      this.ctx.fillStyle = '#000000';
      this.ctx.font = '10px Arial';
      this.ctx.fillText(element.name, x + 5, y + 12);
    }
  }

  /**
   * Настраивает стили рисования в зависимости от типа элемента
   * @param {Object} element - Элемент
   */
  _configureStyle(element) {
    if (!this.ctx) return;
    
    this.ctx.fillStyle = this._getColor(element.type, 'fill');
    this.ctx.strokeStyle = this._getColor(element.type, 'stroke');
    this.ctx.lineWidth = this._getLineWidth(element.type);
  }

  /**
   * Получает цвет для типа элемента
   * @param {string} type - Тип элемента
   * @param {string} style - 'fill' или 'stroke'
   * @returns {string} Цвет в формате CSS
   */
  _getColor(type, style) {
    const colors = {
      wall: {
        fill: '#f5f5f5',
        stroke: '#212121'
      },
      floor: {
        fill: '#d7ccc8',
        stroke: '#5d4037'
      },
      door: {
        fill: '#ffffff',
        stroke: '#000000'
      },
      window: {
        fill: '#e0f7fa',
        stroke: '#006064'
      },
      furniture: {
        fill: '#bdbdbd',
        stroke: '#757575'
      }
    };
    
    const colorSet = colors[type] || colors.wall;
    return colorSet[style] || '#000000';
  }

  /**
   * Получает толщину линии для типа элемента
   * @param {string} type - Тип элемента
   * @returns {number} Толщина линии
   */
  _getLineWidth(type) {
    const widths = {
      wall: 2,
      floor: 3,
      door: 1,
      window: 2,
      furniture: 1
    };
    
    return widths[type] || 1;
  }

  /**
   * Очищает Canvas
   */
  clear() {
    if (this.ctx && this.ctx.canvas) {
      this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
    }
  }

  /**
   * Преобразует 3D элементы в 2D план
   * @param {Array} viewerElements - Элементы 3D viewer
   * @returns {Array} Элементы 2D плана
   */
  toPlan(viewerElements) {
    return viewerElements.map(element => ({
      ...element,
      position: {
        x: element.position?.x || 0,
        y: element.position?.y || 0,
        z: 0
      }
    }));
  }
}

/**
 * Адаптер для интеграции с редактором
 */
export class EditorAdapter {
  constructor() {
    this.canvasAdapter = new CanvasAdapter();
  }

  /**
   * Преобразует элементы для редактора
   * @param {Array} planElements - Элементы 2D плана
   * @returns {Array} Элементы для редактора
   */
  toEditor(planElements) {
    return planElements.map(element => ({
      id: this._generateId(element),
      type: element.type,
      name: element.name,
      position: {
        x: element.position?.x || 0,
        y: element.position?.y || 0,
        z: element.position?.z || 0
      },
      rotation: element.rotation || 0,
      dimensions: {
        width: element.dimensions?.width || element.geometry?.width || 100,
        height: element.dimensions?.length || element.geometry?.height || 100
      },
      expressId: element.expressId
    }));
  }

  /**
   * Генерирует уникальный ID для элемента
   * @param {Object} element - Элемент
   * @returns {string} Уникальный ID
   */
  _generateId(element) {
    return `element_${element.expressId || Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Преобразует элементы из редактора
   * @param {Array} editorElements - Элементы редактора
   * @returns {Array} Элементы 2D плана
   */
  fromEditor(editorElements) {
    return editorElements.map(element => ({
      expressId: element.expressId,
      name: element.name,
      type: element.type,
      position: element.position,
      rotation: element.rotation,
      dimensions: {
        width: element.dimensions?.width,
        length: element.dimensions?.height
      }
    }));
  }
}