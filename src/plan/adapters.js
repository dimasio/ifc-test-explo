/**
 * Адаптеры для интеграции
 * @module src/plan/adapters
 */

/**
 * Адаптер для интеграции с 3D viewer
 */
export class ViewerAdapter {
  constructor() {
    // TODO: Реализация адаптера viewer
  }

  /**
   * Преобразует 2D элементы для отображения в 3D viewer
   * @param {Array} planElements - Элементы 2D плана
   * @returns {Array} Элементы для 3D viewer
   */
  toViewer(planElements) {
    return [];
  }

  /**
   * Преобразует 3D элементы в 2D план
   * @param {Array} viewerElements - Элементы 3D viewer
   * @returns {Array} Элементы 2D плана
   */
  toPlan(viewerElements) {
    return [];
  }
}

/**
 * Адаптер для интеграции с редактором
 */
export class EditorAdapter {
  constructor() {
    // TODO: Реализация адаптера редактора
  }

  /**
   * Преобразует элементы для редактора
   * @param {Array} planElements - Элементы 2D плана
   * @returns {Array} Элементы для редактора
   */
  toEditor(planElements) {
    return [];
  }

  /**
   * Преобразует элементы из редактора
   * @param {Array} editorElements - Элементы редактора
   * @returns {Array} Элементы 2D плана
   */
  fromEditor(editorElements) {
    return [];
  }
}