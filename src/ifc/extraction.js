/**
 * Извлечение элементов по этажам
 * @module src/ifc/extraction
 */

import { extractStoreys, getStoreyElements } from './storeys.js';

/**
 * Извлекает элементы для конкретного этажа
 * @param {Object} ifcAPI - Экземпляр IfcAPI
 * @param {number} modelId - ID открытой модели
 * @param {Object} storey - Элемент этажа (из extractStoreys)
 * @returns {Array} Массив элементов этажа
 */
export function extractElementsByStorey(ifcAPI, modelId, storey) {
  // TODO: Реализация извлечения элементов этажа
  return [];
}

/**
 * Извлекает конструктивные элементы этажа (стены, колонны, балки, перекрытия)
 * @param {Array} elements - Все элементы этажа
 * @returns {Object} Объект с категориями элементов
 */
export function extractStructuralElements(elements) {
  // TODO: Реализация фильтрации конструктивных элементов
  return {
    walls: [],
    columns: [],
    beams: [],
    slabs: []
  };
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