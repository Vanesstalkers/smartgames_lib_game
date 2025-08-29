(class GameObject {
  _id;
  _col;
  #game;
  #parent;
  #_objects = {};
  #fakeParent = null;
  #preventSaveFields = [];
  #broadcastableFields = [];
  #preventBroadcastFields = [];
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
      if (!this.isGame() && newObject) {
        this.markNew({
          saveToDB: true,
          changes: { masterObject: {} }, // без этого объекты, созданные в ходе игры, попадут на фронт не целиком
        });
      }
    }
  }
  id() {
    return this._id;
  }
  preventSaveFields(fields) {
    if (!fields) return this.#preventSaveFields;
    this.#preventSaveFields.push(...fields);
    return true;
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

    this.game().setChanges(this.prepareChanges(val), clonedConfig);

    lib.utils.mergeDeep({
      masterObj: this,
      target: this,
      source: val,
      config: { deleteNull: true, ...clonedConfig }, // удаляем ключи с null-значением
    });
  }
  prepareChanges(val) {
    return { store: { [this._col]: { [this._id]: val } } };
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
        for (const obj of Object.values(this.#_objects)) parent.addToObjectStorage(obj);
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
      for (const obj of Object.values(this.#_objects)) parent.deleteFromObjectStorage(obj);
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
  shortCode() {
    return this.code.replace(this.getCodePrefix(), '').replace(this.getCodeSuffix(), '');
  }
  getAllObjects({ directParent = this } = {}) {
    return this.select({ directParent });
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
    if (className) {
      let protoChain = this;
      while (protoChain.constructor.name !== 'GameObject') {
        if (protoChain.constructor.name === className) return true;
        protoChain = Object.getPrototypeOf(protoChain);
      }
    }
    return false;
  }
  is(className) {
    return this.matches({ className });
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
    return true;
  }
  preventBroadcastFields(fields) {
    if (!fields) return this.#preventBroadcastFields;
    this.#preventBroadcastFields.push(...fields);
    return true;
  }
  publicStaticFields(data) {
    if (data) this.#publicStaticFields = data;
    return this.#publicStaticFields;
  }

  prepareSaveData() {
    let preparedData;
    const preventSaveFieldsList = this.preventSaveFields();
    if (!preventSaveFieldsList.length) {
      preparedData = this;
    } else {
      preparedData = Object.fromEntries(
        Object.entries(this).filter(([key, val]) => !preventSaveFieldsList.includes(key))
      );
    }
    return preparedData;
  }
  prepareBroadcastData({ data, player, viewerMode }) {
    let visibleId = this._id;
    let preparedData;
    const broadcastableFieldsList = this.broadcastableFields();
    if (broadcastableFieldsList.length === 0) {
      preparedData = data;
    } else {
      preparedData = Object.fromEntries(
        Object.entries(data).filter(([key, val]) => broadcastableFieldsList.includes(key))
      );
    }
    return { visibleId, preparedData };
  }
  getEvent(eventName) {
    const event = domain.game.events?.[eventName] || lib.game.events?.[eventName];
    if (!event) return null;
    return event();
  }
  initEvent(eventData, { game, player, allowedPlayers = [], publicHandlers = [], initData = {} } = {}) {
    if (typeof eventData === 'string') {
      const eventName = eventData;
      eventData = this.getEvent(eventName);
      eventData.name = eventName;
    }
    if (!eventData) throw new Error(`event not found (event=${eventName})`);

    if (this.matches({ className: 'Player' })) player = this;
    if (!game) game = this.isGame() ? this : this.game();

    let event = new lib.game.GameEvent(eventData);

    event.source(this);
    event.game(game);
    event.player(player);
    event.allowedPlayers(allowedPlayers);
    event.publicHandlers(publicHandlers);

    this.addEvent(event);

    if (event.handlers('RESET').length === 0) {
      // у объекта одновременно может быть несколько RESET-событий, но они всегда вызываются через emit(...), так что лишние события не вызовутся
      event.setHandler('RESET', function () {
        this.destroy();
      });
    }
    const handlers = event.handlers();
    for (const handler of handlers) {
      if (handler === 'TRIGGER') {
        player?.setEventWithTriggerListener(event);
      } else {
        game.addEventListener({ handler, event });
      }
    }

    if (event.init) {
      const { resetEvent } = event.init(initData) || {};
      if (resetEvent) {
        event.emit('RESET');
        event = null;
      }
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
  /**
   * Проверяет наличие активного события замены костяшек
   * @returns {boolean} true если есть активное событие замены костяшек
   */
  hasDiceReplacementEvent() {
    return this.eventData.activeEvents.some((event) => event.name === 'diceReplacementEvent');
  }
});
