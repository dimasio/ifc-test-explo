/**
 * Утилиты для работы с IFC API
 * @module src/ifc/ifcUtils
 */

/**
 * Инициализирует IfcAPI
 * @returns {Promise<Object>} Экземпляр IfcAPI
 */
export async function initIfcAPI() {
  const { IfcAPI } = await import('web-ifc');
  const ifcAPI = new IfcAPI();
  // В web-ifc@0.0.66 метод называется Init (заглавная I), а не init
  await ifcAPI.Init();
  return ifcAPI;
}

/**
 * Извлекает позицию элемента из ObjectPlacement
 * @param {Object} ifcAPI - Экземпляр IfcAPI
 * @param {number} modelId - ID открытой модели
 * @param {number} expressId - Express ID элемента
 * @returns {Object|null} { x, y, z } в миллиметрах или null
 */
export function extractPosition(ifcAPI, modelId, expressId) {
  try {
    const element = ifcAPI.GetLine(modelId, expressId);
    if (!element || !element.ObjectPlacement) {
      return { x: 0, y: 0, z: 0 };
    }
    
    const placementId = element.ObjectPlacement.value;
    if (!placementId) {
      return { x: 0, y: 0, z: 0 };
    }
    
    const position = extractPlacementPosition(ifcAPI, modelId, placementId);
    return position;
  } catch (e) {
    console.error('Ошибка при извлечении позиции:', e);
    return { x: 0, y: 0, z: 0 };
  }
}

/**
 * Рекурсивно извлекает позицию из цепочки placement
 * @param {Object} ifcAPI - Экземпляр IfcAPI
 * @param {number} modelId - ID открытой модели
 * @param {number} placementId - ID Placement
 * @param {number} depth - Текущая глубина рекурсии
 * @returns {Object} { x, y, z } в миллиметрах
 */
function extractPlacementPosition(ifcAPI, modelId, placementId, depth = 0) {
  const MAX_DEPTH = 10;
  
  if (depth >= MAX_DEPTH) {
    return { x: 0, y: 0, z: 0 };
  }
  
  const placement = ifcAPI.GetLine(modelId, placementId);
  if (!placement) {
    return { x: 0, y: 0, z: 0 };
  }
  
  let x = 0, y = 0, z = 0;
  
  // Обрабатываем RelativePlacement
  if (placement.RelativePlacement) {
    const relPlacementId = placement.RelativePlacement.value;
    const relPlacement = ifcAPI.GetLine(modelId, relPlacementId);
    
    if (relPlacement?.Location) {
      const locationId = relPlacement.Location.value;
      const location = ifcAPI.GetLine(modelId, locationId);
      
      if (location?.Coordinates && location.Coordinates.length >= 3) {
        x = Number(location.Coordinates[0].value) || 0;
        y = Number(location.Coordinates[1].value) || 0;
        z = Number(location.Coordinates[2].value) || 0;
      }
    }
  }
  
  // Если есть PlacementRelTo, продолжаем рекурсию
  if (placement.PlacementRelTo) {
    const parentPlacementId = placement.PlacementRelTo.value;
    const parentPosition = extractPlacementPosition(ifcAPI, modelId, parentPlacementId, depth + 1);
    x += parentPosition.x;
    y += parentPosition.y;
    z += parentPosition.z;
  }
  
  return { x, y, z };
}

/**
 * Извлекает поворот элемента из ObjectPlacement
 * @param {Object} ifcAPI - Экземпляр IfcAPI
 * @param {number} modelId - ID открытой модели
 * @param {number} expressId - Express ID элемента
 * @returns {number} Поворот в градусах
 */
export function extractRotation(ifcAPI, modelId, expressId) {
  try {
    const element = ifcAPI.GetLine(modelId, expressId);
    if (!element || !element.ObjectPlacement) {
      return 0;
    }
    
    const placementId = element.ObjectPlacement.value;
    if (!placementId) {
      return 0;
    }
    
    // Извлекаем координаты направления (Axis) из Placement
    const placement = ifcAPI.GetLine(modelId, placementId);
    if (placement && placement.Axis) {
      const axisId = placement.Axis.value;
      const axis = ifcAPI.GetLine(modelId, axisId);
      
      if (axis?.DirectionRatios && axis.DirectionRatios.length >= 2) {
        const x = Number(axis.DirectionRatios[0].value) || 0;
        const y = Number(axis.DirectionRatios[1].value) || 0;
        // Вычисляем угол в градусах
        const angleRad = Math.atan2(y, x);
        return (angleRad * 180) / Math.PI;
      }
    }
    
    return 0;
  } catch (e) {
    return 0;
  }
}

/**
 * Извлекает размеры элемента (длина/ширина)
 * @param {Object} ifcAPI - Экземпляр IfcAPI
 * @param {number} modelId - ID открытой модели
 * @param {number} expressId - Express ID элемента
 * @returns {Object|null} { length, width } или null
 */
export function extractDimensions(ifcAPI, modelId, expressId) {
  try {
    // Пытаемся получить размеры из свойств
    const properties = extractProperties(ifcAPI, modelId, expressId);
    
    // Проверяем типичные свойства размеров
    let length = 0;
    let width = 0;
    
    // Ищем длину
    if (properties['Dimensions.Length']) {
      length = Number(properties['Dimensions.Length']) || 0;
    }
    if (properties['Dimensions.Width']) {
      width = Number(properties['Dimensions.Width']) || 0;
    }
    
    // Fallback: стандартные значения
    if (length === 0) length = 1000;
    if (width === 0) width = 200;
    
    return { length, width };
  } catch (e) {
    return null;
  }
}

/**
 * Извлекает свойства элемента
 * @param {Object} ifcAPI - Экземпляр IfcAPI
 * @param {number} modelId - ID открытой модели
 * @param {number} expressId - Express ID элемента
 * @returns {Object} Свойства элемента
 */
export function extractProperties(ifcAPI, modelId, expressId) {
  const properties = {};
  
  try {
    const allLines = [...ifcAPI.GetAllLines(modelId)];
    
    for (const lineId of allLines) {
      const line = ifcAPI.GetLine(modelId, lineId);
      
      if (!line || line.type !== 23) continue; // Pset definition
      
      if (!line.RelatedObjects || !line.RelatingPropertyDefinition) continue;
      
      let isRelated = false;
      for (let j = 0; j < line.RelatedObjects.length; j++) {
        if (line.RelatedObjects[j].oid === expressId) {
          isRelated = true;
          break;
        }
      }
      
      if (!isRelated) continue;
      
      const propertySet = line.RelatingPropertyDefinition;
      if (!propertySet || !propertySet.HasProperties) continue;
      
      const setName = propertySet.Name?.value || 'Unnamed';
      
      for (let j = 0; j < propertySet.HasProperties.length; j++) {
        const prop = propertySet.HasProperties[j];
        const propName = prop.Name?.value || 'Unnamed';
        const propNameFull = `${setName}.${propName}`;
        
        if (prop.NominalValue) {
          properties[propNameFull] = prop.NominalValue.value;
        }
      }
    }
  } catch (e) {
    // Silent fail
  }
  
  return properties;
}

/**
 * Строит карту свойств для всех элементов модели
 * @param {Object} ifcAPI - Экземпляр IfcAPI
 * @param {number} modelId - ID открытой модели
 * @returns {Map} Карта expressId -> properties
 */
export function buildPropertiesMap(ifcAPI, modelId) {
  const propertiesMap = new Map();
  
  try {
    const allLines = [...ifcAPI.GetAllLines(modelId)];
    
    for (const lineId of allLines) {
      const line = ifcAPI.GetLine(modelId, lineId);
      
      if (!line || line.type !== 23) continue; // Pset definition
      
      if (!line.RelatedObjects || !line.RelatingPropertyDefinition) continue;
      
      // Собираем все свойства для этой Pset
      const propertySet = line.RelatingPropertyDefinition;
      if (!propertySet || !propertySet.HasProperties) continue;
      
      const setName = propertySet.Name?.value || 'Unnamed';
      
      for (const relatedObj of line.RelatedObjects) {
        const elementId = relatedObj.oid;
        
        if (!propertiesMap.has(elementId)) {
          propertiesMap.set(elementId, {});
        }
        
        const elementProps = propertiesMap.get(elementId);
        
        for (let j = 0; j < propertySet.HasProperties.length; j++) {
          const prop = propertySet.HasProperties[j];
          const propName = prop.Name?.value || 'Unnamed';
          const propNameFull = `${setName}.${propName}`;
          
          if (prop.NominalValue) {
            elementProps[propNameFull] = prop.NominalValue.value;
          }
        }
      }
    }
  } catch (e) {
    // Silent fail
  }
  
  return propertiesMap;
}