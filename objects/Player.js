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
      'timerEndTime',
      'timerUpdateTime',
      'eventData',
      'activeEvent',
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
});
