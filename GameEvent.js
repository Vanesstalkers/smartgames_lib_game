(class GameEvent {
  #source;
  #game;
  #player;
  #allowedPlayers;
  #init;
  #handlers;
  constructor({ init, handlers, ...data }) {
    this.#init = init;
    this.#handlers = handlers || {};
    Object.assign(this, data);
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
  allowedPlayers(data) {
    if (data) this.#allowedPlayers = data;
    return this.#allowedPlayers;
  }
  set(val, config = {}) {
    lib.utils.mergeDeep({
      masterObj: this,
      target: this,
      source: val,
      config: { deleteNull: true, ...config }, // удаляем ключи с null-значением
    });
  }
  getTitle() {
    return this.#source.title || this.#source.name || this.#source.code;
  }

  eventContext() {
    return {
      source: this.#source,
      game: this.#game,
      player: this.#player || this.#game.getActivePlayer(),
      allowedPlayers: this.#allowedPlayers,
      sourceId: this.sourceId(),
    };
  }
  hasInitAction() {
    return this.#init ? true : false;
  }
  hasHandler(handler) {
    return this.#handlers[handler] ? true : false;
  }
  init() {
    if (this.hasInitAction()) return this.#init();
  }
  handlers() {
    return Object.keys(this.#handlers);
  }
  addHandler(code, handler) {
    this.#handlers[code] = handler;
  }
  emit(handler, data = {}, initPlayer) {
    if (data.targetId) data.target = this.#game.get(data.targetId);
    handler = this.#handlers[handler];
    if (handler) return handler.call(this, { ...data, initPlayer });
  }
});
