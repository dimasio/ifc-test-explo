/**
 * Модель 2D плана
 * @module src/plan/model
 */

/**
 * Класс для управления 2D планом
 */
export class PlanModel {
  constructor() {
    this.elements = [];
    this.metadata = {
      name: '',
      scale: 1,
      units: 'mm'
    };
  }

  /**
   * Добавляет элемент в план
   * @param {Object} element - Элемент плана
   */
  addElement(element) {
    // TODO: Реализация добавления элемента
  }

  /**
   * Получает все элементы плана
   * @returns {Array} Массив элементов
   */
  getElements() {
    return this.elements;
  }

  /**
   * Очищает план
   */
  clear() {
    this.elements = [];
  }

  /**
   * Устанавливает метаданные плана
   * @param {Object} metadata - Метаданные
   */
  setMetadata(metadata) {
    Object.assign(this.metadata, metadata);
  }

  /**
   * Получает метаданные плана
   * @returns {Object} Метаданные
   */
  getMetadata() {
    return this.metadata;
  }
}