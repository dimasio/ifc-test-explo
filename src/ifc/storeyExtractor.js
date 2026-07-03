/**
 * Извлечение этажей (IfcBuildingStoreY) из IFC модели
 * @module src/ifc/storeyExtractor
 */

/**
 * Имена типов для IFC элементов этажей
 * В web-ifc type - это хэш чисел, поэтому используем GetNameFromTypeCode
 */
const IFC_STOREY_TYPE_NAMES = ['IfcBuildingStorey'];

/**
 * Извлекает этажи из IFC модели
 * Поддерживает IFC 2x3 и IFC 4
 * @param {Object} ifcAPI - Экземпляр IfcAPI
 * @param {number} modelId - ID открытой модели
 * @returns {Array} Массив этажей с контрактом: { id, expressId, name, elevation, index }[]
 */
export function extractStoreys(ifcAPI, modelId) {
  const storeys = [];
  
  try {
    const allLines = [...ifcAPI.GetAllLines(modelId)];
    
    // Проходим по всем линиям и ищем IfcBuildingStorey
    for (const expressId of allLines) {
      const element = ifcAPI.GetLine(modelId, expressId);
      
      if (!element || element.type === -1) {
        continue;
      }
      
      // Получаем имя типа и проверяем, является ли это этажом
      const typeName = ifcAPI.GetNameFromTypeCode(element.type);
      const isStoreyType = IFC_STOREY_TYPE_NAMES.includes(typeName);
      
      if (isStoreyType) {
        const storey = extractStoreyData(ifcAPI, modelId, element, expressId);
        if (storey) {
          storeys.push(storey);
        }
      }
    }
    
    // Сортируем этажи по elevation (снизу вверх)
    storeys.sort((a, b) => a.elevation - b.elevation);
    
    // Назначаем индексы после сортировки
    storeys.forEach((storey, index) => {
      storey.index = index;
    });
    
  } catch (e) {
    // Silent fail - возвращаем пустой массив
    console.error('Ошибка при извлечении этажей:', e);
  }
  
  return storeys;
}

/**
 * Извлекает данные одного этажа
 * @param {Object} ifcAPI - Экземпляр IfcAPI
 * @param {number} modelId - ID открытой модели
 * @param {Object} element - Линия элемента
 * @param {number} expressId - Express ID элемента
 * @returns {Object|null} Данные этажа или null
 */
function extractStoreyData(ifcAPI, modelId, element, expressId) {
  try {
    // Имя этажа
    const name = element.Name?.value || `Storey_${expressId}`;
    
    // Координаты размещения (elevation)
    const elevation = extractElevation(ifcAPI, modelId, element);
    
    // Уникальный ID для стабильности (используем expressId)
    const id = createStableId(name, elevation, expressId);
    
    return {
      id,
      expressId,
      name,
      elevation,
      index: -1 // Будет установлено после сортировки
    };
  } catch (e) {
    return null;
  }
}

/**
 * Извлекает elevation (высоту) этажа из ObjectPlacement
 * @param {Object} ifcAPI - Экземпляр IfcAPI
 * @param {number} modelId - ID открытой модели
 * @param {Object} element - Линия элемента
 * @returns {number} Elevation в метрах
 */
function extractElevation(ifcAPI, modelId, element) {
  try {
    if (!element || !element.ObjectPlacement) {
      return 0;
    }
    
    const placementId = element.ObjectPlacement.value;
    if (!placementId) {
      return 0;
    }
    
    const elevationZ = extractPlacementElevation(ifcAPI, modelId, placementId);
    
    return elevationZ;
  } catch (e) {
    return 0;
  }
}

/**
 * Рекурсивно извлекает Z координату (elevation) из цепочки placement
 * @param {Object} ifcAPI - Экземпляр IfcAPI
 * @param {number} modelId - ID открытой модели
 * @param {number} placementId - ID Placement
 * @param {number} depth - Текущая глубина рекурсии
 * @returns {number} Elevation в миллиметрах
 */
function extractPlacementElevation(ifcAPI, modelId, placementId, depth = 0) {
  const MAX_DEPTH = 10;
  
  if (depth >= MAX_DEPTH) {
    return 0;
  }
  
  const placement = ifcAPI.GetLine(modelId, placementId);
  if (!placement) {
    return 0;
  }
  
  let elevation = 0;
  
  // Обрабатываем RelativePlacement
  if (placement.RelativePlacement) {
    const relPlacementId = placement.RelativePlacement.value;
    const relPlacement = ifcAPI.GetLine(modelId, relPlacementId);
    
    if (relPlacement?.Location) {
      const locationId = relPlacement.Location.value;
      const location = ifcAPI.GetLine(modelId, locationId);
      
      if (location?.Coordinates && location.Coordinates.length >= 3) {
        // Elevation - это третья координата (Z)
        elevation = Number(location.Coordinates[2].value) || 0;
      }
    }
  }
  
  // Если есть PlacementRelTo, продолжаем рекурсию
  if (placement.PlacementRelTo) {
    const parentPlacementId = placement.PlacementRelTo.value;
    const parentElevation = extractPlacementElevation(ifcAPI, modelId, parentPlacementId, depth + 1);
    elevation += parentElevation;
  }
  
  return elevation;
}

/**
 * Создает стабильный ID для этажа
 * Использует expressId как основной идентификатор (стабилен для одной модели)
 * Fallback на имя + elevation для дополнительной уникальности
 * @param {string} name - Имя этажа
 * @param {number} elevation - Высота
 * @param {number} expressId - Express ID элемента
 * @returns {string} Уникальный ID
 */
function createStableId(name, elevation, expressId) {
  // Основной идентификатор - expressId (стабилен для одной модели)
  // Добавляем префикс для читаемости и разделения от других типов элементов
  const prefix = 'STORY';
  // expressId гарантированно уникален внутри модели
  return `${prefix}_${expressId}`;
}

/**
 * Получает этаж по имени
 * @param {Array} storeys - Массив этажей
 * @param {string} name - Имя этажа
 * @returns {Object|null} Элемент этажа или null
 */
export function getStoreyByName(storeys, name) {
  if (!name) return null;
  
  // Сначала ищем по точному совпадению имени
  for (const storey of storeys) {
    if (storey.name === name) {
      return storey;
    }
  }
  
  // Если не найдено, ищем по частичному совпадению (начало имени)
  for (const storey of storeys) {
    if (storey.name.startsWith(name)) {
      return storey;
    }
  }
  
  return null;
}

/**
 * Получает все элементы этажа
 * @param {Object} ifcAPI - Экземпляр IfcAPI
 * @param {number} modelId - ID открытой модели
 * @param {Object} storey - Элемент этажа
 * @param {Array} allElements - Все элементы модели (опционально для оптимизации)
 * @returns {Array} Массив элементов этажа
 */
export function getStoreyElements(ifcAPI, modelId, storey, allElements = null) {
  const elements = [];
  
  try {
    // Если все элементы не переданы, получаем их
    if (!allElements) {
      const allLines = [...ifcAPI.GetAllLines(modelId)];
      allElements = allLines.map(id => ifcAPI.GetLine(modelId, id));
    }
    
    // Для каждого элемента проверяем, привязан ли он к этажу через RelContainedInSpatialStructure
    for (const element of allElements) {
      if (!element || element.type === -1) continue;
      
      // Проверяем RelContainedInSpatialStructure
      if (element.RelContainedInSpatialStructure) {
        for (const relation of element.RelatedElements) {
          if (relation && relation.value === storey.expressId) {
            elements.push({
              expressId: element.expressId,
              type: element.type,
              typeId: element.typeId,
              name: element.Name?.value || ''
            });
            break;
          }
        }
      }
    }
    
  } catch (e) {
    console.error('Ошибка при получении элементов этажа:', e);
  }
  
  return elements;
}