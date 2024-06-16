(class Player extends lib.game.GameObject {
  constructor(data, { parent }) {
    super(data, { col: 'player', parent });
    Object.assign(this, {
      ...lib.game.decorators['@hasDeck'].decorate(),
    });

    this.preventSaveFields(['decks']);

    this.broadcastableFields([
      ...['_id', 'code', 'userId', 'avatarCode', 'avatarsMap', 'active', 'ready', 'activeReady'],
      ...['timerEndTime', 'timerUpdateTime', 'eventData', 'deckMap', 'staticHelper'],
    ]);

    const { userId, avatarCode, avatarsMap = {}, active, activeReady, timerEndTime, timerUpdateTime } = data;
    this.set({
      ready: false, // при восстановлении игры нужна повторная обработка initPlayerWaitEvents
      ...{ userId, avatarCode, avatarsMap, active, activeReady, timerEndTime, timerUpdateTime },
    });
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
    this.set({ active: true, activeReady: false, eventData: { actionsDisabled: null } });
    if (setData) this.set(setData);
    if (publishText) this.publishInfo({ text: publishText, hideTime: 5000 });
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
});
