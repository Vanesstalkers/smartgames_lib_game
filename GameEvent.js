(class GameEvent {
  #source;
  #game;
  #player;
  #init;
  #handlers;
  constructor({ init, handlers, ...data }) {
    this.#init = init;
    this.#handlers = handlers || {};
    Object.assign(this, data); // можно без set(), потому что в initEvent делается source.set({activeEvent: event}) уже после создания event
  }
  source(data) {
    if (data) this.#source = data;
    return this.#source;
  }
  sourceId() {
    return this.#source.id();
  }
  game(data) {
    if (data) this.#game = data;
    return this.#game;
  }
  player(data) {
    if (data) this.#player = data;
    return this.#player;
  }
  set(val, config = {}) {
    const source = this.source();
    if (!source._col) {
      throw new Error(`set error ('_col' is no defined)`);
    } else {
      this.#game.setChanges({ store: { [source._col]: { [source._id]: { activeEvent: val } } } }, config);
    }
    lib.utils.mergeDeep({
      masterObj: this,
      target: this,
      source: val,
      config: { deleteNull: true, ...config }, // удаляем ключи с null-значением
    });
  }

  eventContext() {
    return {
      source: this.#source,
      game: this.#game,
      player: this.#player,
      sourceId: this.sourceId(),
    };
  }
  hasInitAction() {
    return this.#init ? true : false;
  }
  init() {
    if (this.hasInitAction()) return this.#init();
  }
  handlers() {
    return Object.keys(this.#handlers);
  }
  emit(handler, data = {}) {
    if (data.targetId) data.target = this.#game.getObjectById(data.targetId);
    handler = this.#handlers[handler];
    if (handler) return handler.call(this, data);
  }
});
