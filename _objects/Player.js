(class Player extends lib.game.GameObject {
  #eventWithTriggerListener = null;

  constructor(data, { parent }) {
    super(data, { col: 'player', parent });
    Object.assign(this, {
      ...lib.game.decorators['@hasDeck'].decorate(),
    });

    this.preventSaveFields(['decks']);

    this.broadcastableFields([
      ...['_id', 'code', 'gameId', 'userId', 'userName', 'avatarCode', 'avatarsMap', 'active', 'ready'],
      ...['timerEndTime', 'timerUpdateTime', 'eventData', 'deckMap', 'staticHelper'],
    ]);

    const { userId, userName, avatarCode, avatarsMap = {} } = data;
    const { eventData = {}, active, timerEndTime, timerUpdateTime, ai, aiActions } = data;
    this.set({
      ready: false, // при восстановлении игры нужна повторная обработка initPlayerWaitEvents
      ...{ userId, userName, eventData, avatarCode, avatarsMap, active, timerEndTime, timerUpdateTime },
      ...(ai ? { ai, aiActions } : {}),
    });
  }

  prepareBroadcastData({ data, player }) {
    const bFields = this.broadcastableFields();
    let preparedData;
    if (!bFields) {
      preparedData = data;
    } else {
      preparedData = {};
      for (const [key, value] of Object.entries(data)) {
        if (bFields.includes(key)) {
          if (key === 'eventData' && player !== this)
            preparedData[key] = {}; // чтобы на фронте не делать лишние проверки
          else preparedData[key] = value;
        }
      }
    }

    return { preparedData, visibleId: this._id };
  }

  game(game) {
    const result = super.game(game);
    if (game) {
      // внутри .set() есть обращение к .game(), которого могло установиться строчкой выше
      this.set({ gameId: game.id() });
    }
    return result;
  }
  nextPlayer() {
    const players = this.game().players();
    const idx = players.indexOf(this);
    return players[(idx + 1) % players.length];
  }
  prevPlayer() {
    const players = this.game().players();
    const idx = players.indexOf(this);
    return players[(idx - 1 + players.length) % players.length];
  }
  returnTableCardsToHand() {
    for (const deck of this.select({ className: 'Deck', attr: { placement: 'table' } })) {
      for (const card of deck.items()) {
        if (card.eventData.canReturn) card.returnToHand({ player: this });
      }
    }
  }
  triggerEventEnabled({ ignoreEvents = [] } = {}) {
    const ignore = ignoreEvents.includes(this.#eventWithTriggerListener?.name);
    const enabled = this.#eventWithTriggerListener !== null && !ignore;
    return enabled ? this.#eventWithTriggerListener : false;
  }

  activate({ setData, notifyUser } = {}) {
    this.set({ active: true });
    if (setData) this.set(setData);
    if (notifyUser) this.notifyUser(notifyUser);
  }
  deactivate({ setData = {}, notifyUser } = {}) {
    this.set({ active: false, eventData: { actionsDisabled: null } });
    if (setData) this.set(setData);
    if (notifyUser) this.notifyUser(notifyUser);
  }

  async updateUser(data = {}) {
    const user = lib.store('user').get(this.userId);
    user.set(data);
    await user.saveChanges();
  }
  notifyUser(data = {}, config = {}) {
    if (typeof data === 'string') data = { message: data };
    lib.store.broadcaster.publishAction.call(this.game(), `user-${this.userId}`, 'broadcastToSessions', {
      data,
      config,
    });
  }

  setEventWithTriggerListener(event) {
    if (this.#eventWithTriggerListener) throw new Error('Предыдущее событие не завершено');
    if (!event.hasHandler('TRIGGER')) throw new Error('Событие не содержит обработчик TRIGGER');

    this.#eventWithTriggerListener = event;
    this.set({ eventData: { triggerListenerEnabled: Date.now() } });
  }
  removeEventWithTriggerListener() {
    this.#eventWithTriggerListener = null;
    this.set({ eventData: { triggerListenerEnabled: null } });
  }
  handleEventWithTriggerListener(handler, data = {}) {
    if (!this.#eventWithTriggerListener) throw new Error('Событие не найдено');
    return this.#eventWithTriggerListener.emit(handler, data, this);
  }
});
