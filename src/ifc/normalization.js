/**
 * Нормализация 2D плана
 * @module src/ifc/normalization
 */

import { extractPosition, extractRotation, extractDimensions } from './ifcUtils.js';

/**
 * Извлекает массив точек (polygon) из элемента IFC
 * Для стен используем bounding box как fallback
 * @param {Object} ifcAPI - Экземпляр IfcAPI
 * @param {number} modelId - ID открытой модели
 * @param {Object} element - Линия элемента
 * @returns {Array|null} Массив точек polygon или null
 */
function extractPolygon(ifcAPI, modelId, element) {
  try {
    // Пытаемся получить геометрию через IfcAPI
    // Для упрощения используем position + fallback dimensions
    const position = extractPosition(ifcAPI, modelId, element.expressId);
    
    // Fallback: axis + thickness для стен
    if (element.type === 10 || element.type === 8) { // Wall или Slab
      // В IFC стены имеют толщину через IfcWallStandardCase or IfcSlab
      // Для упрощения используем фиксированную толщину или получаем из свойств
      const thickness = 200; // mm - стандартная толщина
      return {
        type: 'rect',
        x: position.x,
        y: position.y,
        width: thickness,
        height: 1000, // Fallback - предполагаем длину стены
        rotation: 0 // TODO: извлечь поворот из ObjectPlacement
      };
    }
    
    return {
      type: 'point',
      x: position.x,
      y: position.y
    };
  } catch (e) {
    return null;
  }
}

/**
 * Нормализует координаты элементов этажа к началу координат
 * Сдвигает все элементы так, чтобы минимальные x и y были 0
 * @param {Array} elements - Массив элементов этажа
 * @returns {Array} Нормализованные элементы
 */
export function normalizeCoordinates(elements) {
  if (!elements || elements.length === 0) {
    return elements;
  }
  
  // Находим минимальные координаты
  let minX = Infinity;
  let minY = Infinity;
  
  for (const element of elements) {
    if (element.position?.x !== undefined) {
      minX = Math.min(minX, element.position.x);
    }
    if (element.position?.y !== undefined) {
      minY = Math.min(minY, element.position.y);
    }
  }
  
  // Сдвигаем все элементы
  if (minX !== Infinity && minY !== Infinity) {
    return elements.map(element => ({
      ...element,
      position: {
        x: element.position?.x !== undefined ? element.position.x - minX : 0,
        y: element.position?.y !== undefined ? element.position.y - minY : 0,
        z: element.position?.z || 0
      }
    }));
  }
  
  return elements;
}

/**
 * Создает 2D проекцию элементов этажа
 * @param {Array} elements - Массив элементов этажа
 * @returns {Array} 2D элементы (x, y координаты)
 */
export function create2DProjection(elements) {
  return elements.map(element => ({
    ...element,
    position: {
      x: element.position?.x || 0,
      y: element.position?.y || 0,
      z: 0 // 2D projection - z игнорируется
    }
  }));
}

/**
 * Упрощает геометрию элементов для 2D плана
 * Заменяет сложную геометрию на примитивы (прямоугольники, точки)
 * @param {Array} elements - Массив элементов этажа
 * @returns {Array} Упрощенные элементы
 */
export function simplifyGeometry(elements) {
  return elements.map(element => ({
    ...element,
    geometry: element.geometry || {
      type: element.type === 14 || element.type === 15 ? 'rect' : 'rect',
      width: 200,
      height: 1000
    }
  }));
}

/**
 * Преобразует элементы этажа в editor-facing JSON формат
 * @param {Object} extractionResult - Результат extractElementsByStorey
 * @param {Object} storey - Данные этажа (из extractStoreys)
 * @param {Object} ifcAPI - Экземпляр IfcAPI
 * @param {number} modelId - ID открытой модели
 * @returns {Object} Нормализованный 2D план
 */
export function normalizeStoreyToPlanJson(extractionResult, storey, ifcAPI, modelId) {
  const result = {
    storey: {
      id: storey.id,
      name: storey.name,
      elevation: storey.elevation,
      index: storey.index
    },
    floor: [],
    walls: [],
    openings: [],
    furniture: [],
    groups: {
      walls: [],
      openings: [],
      furniture: [],
      floor: []
    },
    meta: {
      source: 'ifc-extraction',
      timestamp: new Date().toISOString(),
      units: 'mm'
    }
  };
  
  // Обрабатываем пол (floor)
  if (extractionResult.floor && extractionResult.floor.length > 0) {
    const floorElements = normalizeCoordinates(extractionResult.floor);
    for (const element of floorElements) {
      const polygon = extractPolygon(ifcAPI, modelId, element);
      result.floor.push({
        expressId: element.expressId,
        name: element.name,
        position: element.position,
        polygon: polygon,
        type: 'floor'
      });
      result.groups.floor.push(element.expressId);
    }
  }
  
  // Обрабатываем стены
  if (extractionResult.walls && extractionResult.walls.length > 0) {
    const wallElements = normalizeCoordinates(extractionResult.walls);
    for (const element of wallElements) {
      const rotation = extractRotation(ifcAPI, modelId, element.expressId);
      const dimensions = extractDimensions(ifcAPI, modelId, element.expressId);
      result.walls.push({
        expressId: element.expressId,
        name: element.name,
        type: 'wall',
        position: element.position,
        rotation: rotation,
        dimensions: dimensions,
        geometry: {
          type: 'rect',
          width: dimensions?.width || 200,
          height: dimensions?.length || 1000
        }
      });
      result.groups.walls.push(element.expressId);
    }
  }
  
  // Обрабатываем проемы (двери/окна)
  if (extractionResult.openings && extractionResult.openings.length > 0) {
    const openingElements = normalizeCoordinates(extractionResult.openings);
    for (const element of openingElements) {
      const rotation = extractRotation(ifcAPI, modelId, element.expressId);
      result.openings.push({
        expressId: element.expressId,
        name: element.name,
        type: element.type === 14 ? 'door' : 'window',
        position: element.position,
        rotation: rotation,
        geometry: {
          type: 'rect',
          width: 900, // Fallback
          height: 2100
        }
      });
      result.groups.openings.push(element.expressId);
    }
  }
  
  // Обрабатываем мебель (опционально)
  if (extractionResult.furniture && extractionResult.furniture.length > 0) {
    const furnitureElements = normalizeCoordinates(extractionResult.furniture);
    for (const element of furnitureElements) {
      const rotation = extractRotation(ifcAPI, modelId, element.expressId);
      result.furniture.push({
        expressId: element.expressId,
        name: element.name,
        type: 'furniture',
        position: element.position,
        rotation: rotation,
        geometry: {
          type: 'rect',
          width: 1000,
          height: 1000
        }
      });
      result.groups.furniture.push(element.expressId);
    }
  }
  
  return result;
}

/**
 * Преобразует элементы этажа в editor-facing JSON формат (альтернативная функция)
 * @param {Array} elements - Массив всех элементов этажа
 * @param {Object} storey - Данные этажа
 * @param {Object} ifcAPI - Экземпляр IfcAPI
 * @param {number} modelId - ID открытой модели
 * @returns {Object} Нормализованный 2D план
 */
export function createPlanFromElements(elements, storey, ifcAPI, modelId) {
  const result = {
    storey: {
      id: storey.id,
      name: storey.name,
      elevation: storey.elevation,
      index: storey.index
    },
    floor: [],
    walls: [],
    openings: [],
    furniture: [],
    groups: {
      walls: [],
      openings: [],
      furniture: [],
      floor: []
    },
    meta: {
      source: 'ifc-extraction',
      timestamp: new Date().toISOString(),
      units: 'mm'
    }
  };
  
  // Классифицируем элементы по типам
  const walls = [];
  const openings = [];
  const furniture = [];
  const floor = [];
  
  for (const element of elements) {
    if (!element || !element.expressId) continue;
    
    // Определяем тип элемента по typeName или по имени
    const typeName = element.typeName?.toLowerCase() || '';
    const name = element.name?.toLowerCase() || '';
    
    if (typeName.includes('wall') || typeName.includes('стена')) {
      walls.push(element);
    } else if (typeName.includes('door') || typeName.includes('окно') || name.includes('door') || name.includes('window')) {
      openings.push(element);
    } else if (typeName.includes('furnishing') || typeName.includes('мебель') || name.includes('мебель')) {
      furniture.push(element);
    } else if (typeName.includes('slab') || typeName.includes('перекрытие') || name.includes('floor')) {
      floor.push(element);
    } else {
      // По умолчанию добавляем в стены
      walls.push(element);
    }
  }
  
  // Обрабатываем пол
  for (const element of floor) {
    result.floor.push({
      expressId: element.expressId,
      name: element.name,
      type: 'floor',
      position: element.position
    });
    result.groups.floor.push(element.expressId);
  }
  
  // Обрабатываем стены
  for (const element of walls) {
    const rotation = extractRotation(ifcAPI, modelId, element.expressId);
    const dimensions = extractDimensions(ifcAPI, modelId, element.expressId);
    result.walls.push({
      expressId: element.expressId,
      name: element.name,
      type: 'wall',
      position: element.position,
      rotation: rotation,
      dimensions: dimensions,
      geometry: {
        type: 'rect',
        width: dimensions?.width || 200,
        height: dimensions?.length || 1000
      }
    });
    result.groups.walls.push(element.expressId);
  }
  
  // Обрабатываем проемы
  for (const element of openings) {
    const rotation = extractRotation(ifcAPI, modelId, element.expressId);
    result.openings.push({
      expressId: element.expressId,
      name: element.name,
      type: 'opening',
      position: element.position,
      rotation: rotation,
      geometry: {
        type: 'rect',
        width: 900,
        height: 2100
      }
    });
    result.groups.openings.push(element.expressId);
  }
  
  // Обрабатываем мебель
  for (const element of furniture) {
    const rotation = extractRotation(ifcAPI, modelId, element.expressId);
    result.furniture.push({
      expressId: element.expressId,
      name: element.name,
      type: 'furniture',
      position: element.position,
      rotation: rotation,
      geometry: {
        type: 'rect',
        width: 1000,
        height: 1000
      }
    });
    result.groups.furniture.push(element.expressId);
  }
  
  return result;
}