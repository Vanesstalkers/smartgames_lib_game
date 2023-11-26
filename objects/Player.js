(class Player extends lib.game.GameObject {
  constructor(data, { parent }) {
    super(data, { col: 'player', parent });
    Object.assign(this, {
      ...lib.game.decorators['@hasDeck'].decorate(),
    });
    this.broadcastableFields([
      '_id',
      'code',
      'userId',
      'avatarsMap',
      'active',
      'ready',
      'activeReady',
      'timerEndTime',
      'timerUpdateTime',
      'eventData',
      'deckMap',
    ]);

    this.set({
      userId: data.userId,
      avatarCode: data.avatarCode,
      active: data.active,
      ready: data.ready,
      timerEndTime: data.timerEndTime,
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
});
