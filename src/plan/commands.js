/**
 * Команды редактирования 2D плана
 * @module src/plan/commands
 */

/**
 * Базовый класс команды
 */
export class Command {
  constructor() {
    this.name = '';
  }

  execute() {
    throw new Error('Метод execute() должен быть реализован');
  }

  undo() {
    throw new Error('Метод undo() должен быть реализован');
  }
}

/**
 * Команда перемещения элемента
 */
export class MoveCommand extends Command {
  constructor(element, fromPosition, toPosition) {
    super();
    this.name = 'move';
    this.element = element;
    this.fromPosition = { ...fromPosition };
    this.toPosition = { ...toPosition };
  }

  execute() {
    if (this.element.position) {
      this.element.position.x = this.toPosition.x;
      this.element.position.y = this.toPosition.y;
      this.element.position.z = this.toPosition.z || 0;
    }
  }

  undo() {
    if (this.element.position) {
      this.element.position.x = this.fromPosition.x;
      this.element.position.y = this.fromPosition.y;
      this.element.position.z = this.fromPosition.z || 0;
    }
  }
}

/**
 * Команда изменения размера элемента
 */
export class ResizeCommand extends Command {
  constructor(element, fromSize, toSize) {
    super();
    this.name = 'resize';
    this.element = element;
    this.fromSize = { ...fromSize };
    this.toSize = { ...toSize };
  }

  execute() {
    if (this.element.dimensions) {
      this.element.dimensions.width = this.toSize.width;
      this.element.dimensions.length = this.toSize.height;
    }
    if (this.element.geometry) {
      this.element.geometry.width = this.toSize.width;
      this.element.geometry.height = this.toSize.height;
    }
  }

  undo() {
    if (this.element.dimensions) {
      this.element.dimensions.width = this.fromSize.width;
      this.element.dimensions.length = this.fromSize.height;
    }
    if (this.element.geometry) {
      this.element.geometry.width = this.fromSize.width;
      this.element.geometry.height = this.fromSize.height;
    }
  }
}

/**
 * Команда вращения элемента
 */
export class RotateCommand extends Command {
  constructor(element, fromAngle, toAngle) {
    super();
    this.name = 'rotate';
    this.element = element;
    this.fromAngle = fromAngle;
    this.toAngle = toAngle;
  }

  execute() {
    this.element.rotation = this.toAngle;
  }

  undo() {
    this.element.rotation = this.fromAngle;
  }
}

/**
 * Команда создания нового элемента
 */
export class CreateCommand extends Command {
  constructor(element, elementArray) {
    super();
    this.name = 'create';
    this.element = element;
    this.elementArray = elementArray;
  }

  execute() {
    this.elementArray.push(this.element);
  }

  undo() {
    const index = this.elementArray.indexOf(this.element);
    if (index > -1) {
      this.elementArray.splice(index, 1);
    }
  }
}

/**
 * Команда удаления элемента
 */
export class DeleteCommand extends Command {
  constructor(element, elementArray) {
    super();
    this.name = 'delete';
    this.element = element;
    this.elementArray = elementArray;
    this.index = elementArray.indexOf(element);
  }

  execute() {
    const index = this.elementArray.indexOf(this.element);
    if (index > -1) {
      this.elementArray.splice(index, 1);
    }
  }

  undo() {
    if (this.index > -1) {
      this.elementArray.splice(this.index, 1, this.element);
    }
  }
}

/**
 * Команда изменения типа элемента
 */
export class ChangeTypeCommand extends Command {
  constructor(element, fromType, toType) {
    super();
    this.name = 'changeType';
    this.element = element;
    this.fromType = fromType;
    this.toType = toType;
  }

  execute() {
    this.element.type = this.toType;
  }

  undo() {
    this.element.type = this.fromType;
  }
}

/**
 * Менеджер команд с историей изменений
 */
export class CommandManager {
  constructor() {
    this.commands = [];
    this.history = [];
    this.isExecuting = false;
  }

  /**
   * Выполняет команду
   * @param {Command} command - Команда
   */
  execute(command) {
    this.isExecuting = true;
    command.execute();
    this.isExecuting = false;
    this.commands.push(command);
    this.history.push(command);
  }

  /**
   * Откатывает последнюю команду
   */
  undo() {
    if (this.history.length === 0) return;
    const command = this.history.pop();
    command.undo();
  }

  /**
   * Повторяет последнюю отменённую команду
   */
  redo() {
    // В текущей реализации history используется как стек отмены
    // Для полноценного redo нужен отдельный стек
  }

  /**
   * Очищает историю команд
   */
  clear() {
    this.history = [];
  }

  /**
   * Проверяет, есть ли команды для отмены
   */
  canUndo() {
    return this.history.length > 0;
  }

  /**
   * Проверяет, есть ли команды для повтора
   */
  canRedo() {
    // В текущей реализации не поддерживается
    return false;
  }

  /**
   * Получает текущее состояние команды
   * @param {string} type - Тип команды
   * @returns {number} Количество команд определённого типа
   */
  getCommandCount(type) {
    if (!type) {
      return this.commands.length;
    }
    return this.commands.filter(cmd => cmd.name === type).length;
  }
}