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
    this.fromPosition = fromPosition;
    this.toPosition = toPosition;
  }

  execute() {
    // TODO: Реализация перемещения
  }

  undo() {
    // TODO: Реализация отката перемещения
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
    this.fromSize = fromSize;
    this.toSize = toSize;
  }

  execute() {
    // TODO: Реализация изменения размера
  }

  undo() {
    // TODO: Реализация отката изменения размера
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
    // TODO: Реализация вращения
  }

  undo() {
    // TODO: Реализация отката вращения
  }
}

/**
 * Менеджер команд с историей изменений
 */
export class CommandManager {
  constructor() {
    this.commands = [];
    this.history = [];
  }

  /**
   * Выполняет команду
   * @param {Command} command - Команда
   */
  execute(command) {
    command.execute();
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
   * Очищает историю команд
   */
  clear() {
    this.history = [];
  }
}