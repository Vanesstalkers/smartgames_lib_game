(class GameObject {
  _id;
  _col;
  #game;
  #parent;
  #parentList;
  #_objects = {};
  #fakeParent = null;
  #preventSaveFields = [];
  #broadcastableFields = [];
  #publicStaticFields = null; // отправляется в том числе и для фейковых данных, обновлять нельзя (хранятся в объекте-связи родителя-колоды)

  constructor(data, { col: _col, parent } = {}) {
    const newObject = data._id ? false : true;

    if (!this._id) this._id = data._id || db.mongo.ObjectID().toString();
    if (_col) this._col = _col;
    this.fakeId = data.fakeId || {};
    // статичный объект для любых временных данных событий
    this.eventData = data.eventData || { activeEvents: [] };

    this.setParent(parent);

    // строго после setParent, потому что parent может вызваться в getCodeTemplate
    const customObjectCode = Object.getPrototypeOf(this).customObjectCode;
    if (data.code) {
      this.code = data.code;
    } else if (typeof customObjectCode === 'function') {
      const replacementFragment = '$$_code_$$';
      const codeTemplate = this.getCodeTemplate(this.constructor.name + '[' + replacementFragment + ']');
      this.code = customObjectCode.call(this, { codeTemplate, replacementFragment }, data);
    } else {
      this.code = this.getCodeTemplate(this.constructor.name + '[' + (data._code || '') + ']');
    }

    if (!parent) {
      this.game(this); // иначе у корневой игры не будет работать getStore (и возможно что-то еще)
      this.code = ''; // чтобы у дочерних объектов не было префикса "Game[]"
    } else {
      this.game(parent.isGame() ? parent : parent.game());
      if (!this.isGame() && newObject) this.markNew({ saveToDB: true });
    }
  }
  id() {
    return this._id;
  }
  preventSaveFields(fields) {
    if (!fields) return this.#preventSaveFields;
    this.#preventSaveFields.push(...fields);
  }
  updateFakeId({ parentId }) {
    if (!parentId) throw new Error('parentId not found');
    this.fakeId[parentId] = (Date.now() + Math.random()).toString();
  }
  set(val, config = {}) {
    if (!this._col) throw new Error(`set error ('_col' is no defined)`);

    let clonedConfig = {};
    if (Object.keys(config).length > 0) {
      clonedConfig = lib.utils.structuredClone(config);
      if (clonedConfig.reset) {
        clonedConfig.reset = config.reset.map((key) => `store.${this._col}.${this._id}.${key}`);
      }
    }
    this.game().setChanges({ store: { [this._col]: { [this._id]: val } } }, clonedConfig);
    lib.utils.mergeDeep({
      masterObj: this,
      target: this,
      source: val,
      config: { deleteNull: true, ...clonedConfig }, // удаляем ключи с null-значением
    });
  }
  markNew(config) {
    this.game().markNew(this, config);
  }
  markDelete(config) {
    this.game().markDelete(this, config);
  }

  default_customObjectCode({ codeTemplate, replacementFragment }, data) {
    return codeTemplate.replace(replacementFragment, data._code);
  }
  addToParentsObjectStorage() {
    let parent = this.parent();
    if (parent) {
      do {
        parent.addToObjectStorage(this);
      } while ((parent = parent.parent()));
    }
  }
  addToObjectStorage(obj) {
    this.#_objects[obj.id()] = obj;
  }
  deleteFromParentsObjectStorage() {
    let parent = this.parent();
    if (!parent) return;
    do {
      parent.deleteFromObjectStorage(this);
    } while ((parent = parent.parent()));
  }
  deleteFromObjectStorage(obj) {
    if (this.#_objects[obj.id()]) delete this.#_objects[obj.id()];
  }
  getObjectById() {
    return this.get(...arguments);
  }
  get(_id) {
    // _id всегда уникален
    return this.#_objects[_id] || (_id === this.#game.id() ? this.#game : null);
  }
  getObjectByCode() {
    return this.find(...arguments);
  }
  find(code) {
    // внутри одного родителя code может быть не уникален
    return Object.values(this.#_objects).find((obj) => {
      obj.setFakeParent(this);
      const result = obj.code === obj.getCodeTemplate(code);
      obj.setFakeParent(null);
      return result;
    });
  }
  getCodePrefix() {
    return this.parent()?.code || '';
  }
  getCodeSuffix() {
    return '';
  }
  getCodeTemplate(_code) {
    return '' + this.getCodePrefix() + _code + this.getCodeSuffix();
  }
  getObjects() {
    return this.select(...arguments);
  }
  select(query = {}) {
    if (typeof query === 'string') query = { className: query };
    const { className, attr, directParent = this } = query;

    let result = Object.values(this.#_objects);
    if (className) result = result.filter((obj) => obj.constructor.name === className);
    if (directParent) result = result.filter((obj) => obj.parent() === directParent);
    if (attr) {
      for (const [key, val] of Object.entries(attr)) {
        result = result.filter((obj) => obj[key] === val);
      }
    }
    return result;
  }
  setParent(parent) {
    if (parent) {
      this.deleteFromParentsObjectStorage();
      this.#parent = parent;
      this.#parentList = [parent].concat(parent.getParentList() || []); // самый дальний родитель в конце массива
      this.addToParentsObjectStorage();
    }
  }
  setFakeParent(parent) {
    this.#fakeParent = parent;
  }
  updateParent(newParent) {
    this.setParent(newParent);
  }
  parent() {
    return this.#fakeParent || this.#parent;
  }
  getParent() {
    return this.#fakeParent || this.#parent;
  }
  getParentList() {
    return this.#parentList;
  }
  findParent({ className, directParent = false } = {}) {
    let parent = this.parent();
    while (parent) {
      if (className && parent.constructor.name === className) return parent;
      if (directParent && parent === directParent) return parent;
      parent = parent.parent();
    }
    return null;
  }
  matches({ className } = {}) {
    if (className && this.constructor.name === className) return true;
    return false;
  }
  game(game) {
    if (!game) return this.#game;
    this.#game = game;
  }
  isGame() {
    return this instanceof domain.game.class;
  }
  getStore() {
    return this.game().store;
  }
  getFlattenStore() {
    return Object.values(this.getStore()).reduce((obj, item) => ({ ...obj, ...item }), {});
  }
  /**
   * Возвращает или сохраняет список полей, которые можно публиковать
   * @param {string[]} [data] массив полей для публикации
   * @returns {string[]}
   */
  broadcastableFields(fields) {
    if (!fields) return this.#broadcastableFields;
    this.#broadcastableFields.push(...fields);
  }
  publicStaticFields(data) {
    if (data) this.#publicStaticFields = data;
    return this.#publicStaticFields;
  }

  prepareSaveData() {
    let preparedData;
    if (!this.#preventSaveFields.length) {
      preparedData = this;
    } else {
      preparedData = Object.fromEntries(
        Object.entries(this).filter(([key, val]) => !this.#preventSaveFields.includes(key))
      );
    }
    return preparedData;
  }
  prepareBroadcastData({ data, player, viewerMode }) {
    let visibleId = this._id;
    let preparedData;
    if (this.#broadcastableFields.length === 0) {
      preparedData = data;
    } else {
      preparedData = Object.fromEntries(
        Object.entries(data).filter(([key, val]) => this.#broadcastableFields.includes(key))
      );
    }
    return { visibleId, preparedData };
  }
  getEvent(eventName) {
    const event = domain.game.events?.[eventName] || lib.game.events?.[eventName];
    if (!event) return null;
    return event();
  }
  initEvent(event, { player, defaultResetHandler } = {}) {
    if (typeof event === 'string') {
      const eventName = event;
      event = this.getEvent(eventName);
      event.name = eventName;
    }
    if (!event) throw new Error(`event not found (event=${eventName})`);
    const game = this.isGame() ? this : this.game();

    event = new lib.game.GameEvent(event);
    event.source(this);
    event.game(game);
    event.player(player);

    if (event.init) {
      const { removeEvent } = event.init() || {};
      if (removeEvent) return null;
    }
    this.addEvent(event);

    if (defaultResetHandler) {
      event.addHandler('RESET', function () {
        const { game, source, sourceId } = this.eventContext();
        source.removeEvent(this);
        game.removeAllEventListeners({ sourceId });
      });
    }
    for (const handler of event.handlers()) {
      game.addEventListener({ handler, event });
    }

    return event;
  }
  findEvent(attr = {}) {
    return this.eventData.activeEvents.find((event) => {
      const attrEntries = Object.entries(attr);
      const checkResult = attrEntries.filter(([key, val]) => event[key] === val);
      return checkResult.length == attrEntries.length;
    });
  }
  addEvent(event) {
    const activeEvents = this.eventData.activeEvents || [];
    activeEvents.push(event);
    this.set({ eventData: { activeEvents } });
  }
  removeEvent(event) {
    const activeEvents = this.eventData.activeEvents.filter((activeEvent) => {
      return activeEvent !== event;
    });
    this.set({ eventData: { activeEvents } });
  }
});
