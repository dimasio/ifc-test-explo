/**
 * Извлечение элементов по этажам
 * @module src/ifc/extraction
 */

import { IfcAPI } from 'web-ifc';
import { extractPosition } from './ifcUtils.js';

/**
 * Type codes для IFC элементов (IFC 2x3)
 */
const IFC_TYPES_2X3 = {
  WALL: 10,
  SLAB: 8,
  DOOR: 14,
  WINDOW: 15,
  FURNISHING: 13,
  COLUMN: 9,
  BEAM: 5
};

/**
 * Type codes для IFC элементов (IFC 4)
 * Дополнительные типы для IFC 4
 */
const IFC_TYPES_4 = {
  WALL: 10,
  SLAB: 8,
  DOOR: 14,
  WINDOW: 15,
  FURNISHING: 13,
  COLUMN: 9,
  BEAM: 5,
  PILE: 268,     // IfcPile
  DISCUSSION: 269, // IfcDiscreteAccessory
  RAILING: 270,  // IfcRailing
  ROOF: 271      // IfcRoof
};

/**
 * Объединённый набор типов для совместимости
 */
const IFC_TYPES = { ...IFC_TYPES_2X3, ...IFC_TYPES_4 };

/**
 * Type names для всех IFC элементов
 */
const IFC_TYPE_NAMES = {
  10: 'IfcWall',
  8: 'IfcSlab',
  14: 'IfcDoor',
  15: 'IfcWindow',
  13: 'IfcFurnishingElement',
  9: 'IfcColumn',
  5: 'IfcBeam',
  268: 'IfcPile',
  269: 'IfcDiscreteAccessory',
  270: 'IfcRailing',
  271: 'IfcRoof'
};

/**
 * Извлекает элементы для конкретного этажа
 * @param {Object} ifcAPI - Экземпляр IfcAPI
 * @param {number} modelId - ID открытой модели
 * @param {Object} storey - Элемент этажа (из extractStoreys)
 * @returns {Object} Объект с группами элементов
 */
export function extractElementsByStorey(ifcAPI, modelId, storey) {
  const result = {
    floor: [],
    walls: [],
    openings: [],
    furniture: []
  };

  try {
    const allLines = [...ifcAPI.GetAllLines(modelId)];
    
    // Сначала находим все RelContainedInSpatialStructure, которые ссылаются на наш этаж
    const elementIdsInStorey = new Set();
    
    for (const expressId of allLines) {
      const element = ifcAPI.GetLine(modelId, expressId);
      
      if (!element || !element.expressID) {
        continue;
      }
      
      const typeName = ifcAPI.GetNameFromTypeCode(element.type);
      
      // Ищем RelContainedInSpatialStructure, у которого RelatingStructure указывает на наш этаж
      if (typeName === 'IfcRelContainedInSpatialStructure') {
        const relatingStructure = element.RelatingStructure?.value;
        
        if (relatingStructure === storey.expressId) {
          // Получаем элементы этажа из RelatedElements
          if (element.RelatedElements) {
            for (const handle of element.RelatedElements) {
              // Используем handle.oid вместо handle.value
              elementIdsInStorey.add(handle.oid || handle.value);
            }
          }
        }
      }
    }
    
    // Отладка типов элементов
    const typeCounts = {};
    
    // Проход для сбора статистики типов
    for (const elementId of elementIdsInStorey) {
      const element = ifcAPI.GetLine(modelId, elementId);
      
      if (!element || !element.expressID) {
        continue;
      }
      
      const typeName = ifcAPI.GetNameFromTypeCode(element.type);
      typeCounts[typeName] = (typeCounts[typeName] || 0) + 1;
    }
    
    console.log('Type counts for storey', storey.name + ':', typeCounts);
    
    // Второй проход для извлечения данных элементов
    for (const elementId of elementIdsInStorey) {
      const element = ifcAPI.GetLine(modelId, elementId);
      
      if (!element || !element.expressID) {
        continue;
      }
      
      // Классифицируем элемент по типу
      const elementData = extractElementData(ifcAPI, modelId, element);
      
      if (!elementData) {
        continue;
      }
      
      const elementTypeName = ifcAPI.GetNameFromTypeCode(element.type);
      console.log('Processing element', element.expressID, 'type:', element.type, 'typeName:', elementTypeName, 'elementData.typeName:', elementData.typeName);
      
      // Группируем элементы по типу (по имени типа)
      if (elementTypeName === 'IfcSlab') {
        // Пол (перекрытия) - основной тип Slab
        console.log('  -> Adding to floor');
        result.floor.push(elementData);
      } else if (elementTypeName === 'IfcWall' || elementTypeName === 'IfcWallStandardCase' || 
                 elementTypeName === 'IfcCurtainWall' || elementTypeName === 'IfcMovableWall' ||
                 elementTypeName === 'IfcMovingWall') {
        console.log('  -> Adding to walls');
        result.walls.push(elementData);
      } else if (elementTypeName === 'IfcDoor' || elementTypeName === 'IfcDoorStandardCase') {
        result.openings.push(elementData);
      } else if (elementTypeName === 'IfcWindow' || elementTypeName === 'IfcWindowStandardCase') {
        result.openings.push(elementData);
      } else if (elementTypeName === 'IfcColumn' || elementTypeName === 'IfcColumnStandardCase' ||
                 elementTypeName === 'IfcPile') {
        result.walls.push(elementData);
      } else if (elementTypeName === 'IfcBeam' || elementTypeName === 'IfcBeamStandardCase' ||
                 elementTypeName === 'IfcRailing' || elementTypeName === 'IfcStair' ||
                 elementTypeName === 'IfcRamp' || elementTypeName === 'IfcRoof') {
        result.walls.push(elementData);
      } else if (elementTypeName === 'IfcFurnishingElement') {
        result.furniture.push(elementData);
      } else {
        // По умолчанию добавляем в мебель или стены
        result.furniture.push(elementData);
      }
    }
    
  } catch (e) {
    console.error('Ошибка при извлечении элементов этажа:', e);
  }
  
  return result;
}

/**
 * Извлекает данные одного элемента
 * @param {Object} ifcAPI - Экземпляр IfcAPI
 * @param {number} modelId - ID открытой модели
 * @param {Object} element - Линия элемента
 * @returns {Object|null} Данные элемента или null
 */
function extractElementData(ifcAPI, modelId, element) {
  try {
    const position = extractPosition(ifcAPI, modelId, element.expressID);
    const typeName = ifcAPI.GetNameFromTypeCode(element.type) || `IfcType_${element.type}`;
    
    return {
      expressId: element.expressID,
      type: element.type,
      typeName: typeName,
      name: element.Name?.value || '',
      position: position,
      predefinedType: element.PredefinedType?.value || null,
      objectType: element.ObjectType?.value || null
    };
  } catch (e) {
    return null;
  }
}

/**
 * Извлекает подложки (осевые сетки)
 * @param {Array} elements - Все элементы этажа
 * @returns {Array} Массив подложек
 */
export function extractUnderlays(elements) {
  // TODO: Реализация извлечения подложек
  return [];
}

/**
 * Извлекает только конструктивные элементы
 * @param {Object} groupedElements - Объект с группами элементов
 * @returns {Object} Объект с только конструктивными элементами
 */
export function extractStructuralElements(groupedElements) {
  return {
    walls: groupedElements.walls || [],
    columns: [],
    beams: [],
    slabs: groupedElements.floor || []
  };
}

/**
 * Извлекает элементы этажа по путю к файлу и ID этажа
 * Это функция верхнего уровня для внешнего использования
 * @param {string} ifcFilePath - Путь к IFC файлу
 * @param {number} storeyExpressId - Express ID этажа
 * @returns {Promise<Object>} Объект с группами элементов
 */
export async function getStoreyElementsFromPath(ifcFilePath, storeyExpressId) {
  const { IfcAPI } = await import('web-ifc');
  const { initIfcAPI } = await import('./ifcUtils.js');
  const fs = await import('fs');
  const path = await import('path');
  
  const ifcAPI = await initIfcAPI();
  
  const fileBuffer = fs.readFileSync(ifcFilePath);
  const ifcByteArray = new Uint8Array(fileBuffer);
  
  const modelId = ifcAPI.OpenModel(ifcByteArray);
  
  // Получаем этаж по expressId
  const storey = {
    expressId: storeyExpressId,
    id: `STORY_${storeyExpressId}`,
    name: `Storey_${storeyExpressId}`,
    elevation: 0,
    index: 0
  };
  
  // Извлекаем элементы
  const result = extractElementsByStorey(ifcAPI, modelId, storey);
  
  ifcAPI.CloseModel(modelId);
  
  return result;
}