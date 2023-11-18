(class GameObject {
  _id;
  _col;
  #game;
  #parent;
  #parentList;
  #_objects = {};
  #fakeParent = null;
  #broadcastableFields = null;
  #publicStaticFields = null; // отправляется в том числе и для фейковых данных, обновлять нельзя (хранятся в объекте-связи родителя-колоды)

  constructor(data, { col: _col, parent } = {}) {
    const newObject = data._id ? false : true;

    if (!this._id) this._id = data._id || db.mongo.ObjectID().toString();
    if (_col) this._col = _col;
    this.fakeId = data.fakeId || {};
    // индикатор наличия активного события (может быть с вложенными данными)
    if (data.activeEvent) this.activeEvent = data.activeEvent;
    // статичный объект для любых временных данных событий
    this.eventData = data.eventData || { activeEvents: [] };

    this.setParent(parent);
    this.addToParentsObjectStorage();

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
      this.game(this);
      delete this.code; // чтобы у дочерних объектов не было префикса "Game[]"
    } else {
      const game = parent.game();
      this.game(game);
      if (newObject) this.markNew({ saveToDB: true });
      if (!game.store[this._col]) game.store[this._col] = {};
      game.store[this._col][this._id] = this;
    }
  }
  id() {
    return this._id;
  }
  updateFakeId({ parentId }) {
    if (!parentId) throw new Error('parentId not found');
    this.fakeId[parentId] = (Date.now() + Math.random()).toString();
  }
  set(val, config = {}) {
    if (!this._col) {
      throw new Error(`set error ('_col' is no defined)`);
    } else {
      this.setChanges(val, config);
    }
    lib.utils.mergeDeep({
      masterObj: this,
      target: this,
      source: val,
      config: { deleteNull: true, ...config }, // удаляем ключи с null-значением
    });
  }
  setChanges(val, config = {}) {
    this.#game.setChanges({ store: { [this._col]: { [this._id]: val } } }, config);
  }

  setChanges(val, config = {}) {
    const clonedConfig = lib.utils.structuredClone(config);
    if (clonedConfig.reset) clonedConfig.reset = config.reset.map((key) => `store.${this._col}.${this._id}.${key}`);
    this.#game.setChanges(
      {
        store: { [this._col]: { [this._id]: val } },
      },
      clonedConfig
    );
  }

  markNew({ saveToDB = false } = {}) {
    const { _col: col, _id: id } = this;
    if (saveToDB) {
      this.#game.setChanges({ store: { [col]: { [id]: this } } });
    } else {
      this.#game.addBroadcastObject({ col, id });
    }
  }
  markDelete({ saveToDB = false } = {}) {
    const { _col: col, _id: id } = this;
    if (saveToDB) {
      this.#game.setChanges({ store: { [col]: { [id]: null } } });
    } else {
      this.#game.deleteBroadcastObject({ col, id });
    }
  }

  default_customObjectCode({ codeTemplate, replacementFragment }, data) {
    return codeTemplate.replace(replacementFragment, data._code);
  }
  addToParentsObjectStorage() {
    let parent = this.getParent();
    if (parent) {
      do {
        parent.addToObjectStorage(this);
      } while ((parent = parent.getParent()));
    }
  }
  addToObjectStorage(obj) {
    this.#_objects[obj.id()] = obj;
  }
  deleteFromParentsObjectStorage() {
    let parent = this.getParent();
    if (!parent) return;
    do {
      parent.deleteFromObjectStorage(this);
    } while ((parent = parent.getParent()));
  }
  deleteFromObjectStorage(obj) {
    if (this.#_objects[obj.id()]) delete this.#_objects[obj.id()];
  }
  getObjectById(_id) {
    // _id всегда уникален
    return this.#_objects[_id] || (_id === this.#game.id() ? this.#game : null);
  }
  getObjectByCode(code) {
    // внутри одного родителя code может быть не уникален
    return Object.values(this.#_objects).find((obj) => {
      obj.setFakeParent(this);
      const result = obj.code === obj.getCodeTemplate(code);
      obj.setFakeParent(null);
      return result;
    });
  }
  getCodePrefix() {
    return this.getParent()?.code || '';
  }
  getCodeSuffix() {
    return '';
  }
  getCodeTemplate(_code) {
    return '' + this.getCodePrefix() + _code + this.getCodeSuffix();
  }
  getObjects({ className, attr, directParent } = {}) {
    let result = Object.values(this.#_objects);
    if (className) result = result.filter((obj) => obj.constructor.name === className);
    if (directParent) result = result.filter((obj) => obj.getParent() === directParent);
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
    let parent = this.getParent();
    while (parent) {
      if (className && parent.constructor.name === className) return parent;
      if (directParent && parent === directParent) return parent;
      parent = parent.getParent();
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
  broadcastableFields(data) {
    if (!data) return this.#broadcastableFields;
    this.#broadcastableFields = data;
  }
  publicStaticFields(data) {
    if (data) this.#publicStaticFields = data;
    return this.#publicStaticFields;
  }

  prepareBroadcastData({ data, player, viewerMode }) {
    let visibleId = this._id;
    let preparedData;
    if (!this.#broadcastableFields) {
      preparedData = data;
    } else {
      preparedData = {};
      for (const [key, value] of Object.entries(data)) {
        if (this.#broadcastableFields.includes(key)) preparedData[key] = value;
      }
    }
    return { visibleId, preparedData };
  }
  getEvent(eventName) {
    const event = domain.game.events?.[eventName] || lib.game.events?.[eventName];
    if (!event) return null;
    return event();
  }
  initEvent(eventName, { player } = {}) {
    const event = this.getEvent(eventName);
    if (!event) throw new Error(`event not found (event=${eventName})`);

    const game = this.game();
    event.source(this);
    event.game(game);
    event.player(player);
    event.name = eventName;

    if (event.init) event.init();
    this.addEvent(event);

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
