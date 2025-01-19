(class Player extends lib.game.GameObject {
  constructor(data, { parent }) {
    super(data, { col: 'player', parent });
    Object.assign(this, {
      ...lib.game.decorators['@hasDeck'].decorate(),
    });

    this.preventSaveFields(['decks']);

    this.broadcastableFields([
      ...['_id', 'code', 'gameId', 'userId', 'avatarCode', 'avatarsMap', 'active', 'ready'],
      ...['timerEndTime', 'timerUpdateTime', 'eventData', 'deckMap', 'staticHelper'],
    ]);

    const { userId, eventData = {}, avatarCode, avatarsMap = {}, active, timerEndTime, timerUpdateTime } = data;
    this.set({
      ready: false, // при восстановлении игры нужна повторная обработка initPlayerWaitEvents
      ...{ userId, eventData, avatarCode, avatarsMap, active, timerEndTime, timerUpdateTime },
    });
  }

  prepareBroadcastData({ data, player, viewerMode }) {
    const bFields = this.broadcastableFields();
    let visibleId = this._id;
    let preparedData;
    if (!bFields) {
      preparedData = data;
    } else {
      preparedData = {};
      for (const [key, value] of Object.entries(data)) {
        if (bFields.includes(key)) {
          if (key === 'eventData' && player !== this) continue;
          preparedData[key] = value;
        }
      }
    }

    return { visibleId, preparedData };
  }

  game(game) {
    const result = super.game(game);
    if (game) this.set({ gameId: game.id() }); // внутри .set() есть обращение к .game(), которого могло установиться строчкой выше
    return result;
  }
  nextPlayer() {
    const players = this.game().players();
    const idx = players.indexOf(this);
    return players[(idx + 1) % players.length];
  }
  skipRoundCheck() {
    const endRoundEvent = this.findEvent({ skipRound: true });
    if (endRoundEvent) {
      this.game().logs(`Игрок ${this.userName} пропускает ход`);
      this.removeEvent(endRoundEvent);
      return true;
    }
    return false;
  }
  returnTableCardsToHand() {
    for (const deck of this.getObjects({ className: 'Deck', attr: { placement: 'table' } })) {
      const cards = deck.select('Card');
      for (const card of cards) {
        for (const event of card.eventData.activeEvents) event.emit('TRIGGER');
      }
    }
  }
  triggerEventEnabled() {
    return this.eventData.activeEvents.find((event) => event.hasHandler('TRIGGER')) ? true : false;
  }

  activate({ setData, publishText } = {}) {
    this.set({ active: true });
    if (setData) this.set(setData);
    if (publishText) this.publishInfo({ text: publishText, hideTime: 5000 });
  }
  deactivate() {
    this.set({ active: false, eventData: { actionsDisabled: null } });
  }

  publishInfo(info = {}) {
    if (!info.text) return;

    lib.store.broadcaster.publishData(`gameuser-${this.userId}`, {
      helper: {
        text: info.text,
        pos: {
          desktop: 'top-left',
          mobile: 'top-left',
        },
        hideTime: info.hideTime || 3000,
      },
    });
  }
  publishStoreData(storeData) {
    lib.store.broadcaster.publishAction(`gameuser-${this.userId}`, 'broadcastToSessions', {
      type: 'updateStore',
      data: { game: { [this.game().id()]: { store: storeData } } },
    });
  }
});
