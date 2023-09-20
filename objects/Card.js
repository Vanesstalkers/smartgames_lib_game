(class Card extends lib.game.GameObject {
  constructor(data, { parent }) {
    super(data, { col: 'card', parent });
    this.broadcastableFields(['_id', 'name', 'played', 'eventData']);

    this.set({
      title: data.title,
      name: data.name,
      played: data.played,
    });
    this.events(domain.cardEvent[this.name]);
  }
  /**
   * Перемещает карту к новому держателю (колоду)
   * @param {GameObject} target - колода для перемещения
   */
  moveToTarget(target) {
    const currentParent = this.getParent();
    currentParent.removeItem(this); // сначала удаляем
    const moveResult = target.addItem(this);
    if (moveResult) {
      this.updateParent(target);
    } else {
      currentParent.addItem(this);
    }
    return moveResult;
  }
  getSelfConfig() {
    return { handlers: Object.keys(this.events().handlers || {}) };
  }
  isPlayOneTime() {
    return this.events()?.config?.playOneTime;
  }
  restoreAvailable() {
    if (this.isPlayOneTime()) {
      return this.played ? false : true;
    } else {
      return true;
    }
  }
  play() {
    const game = this.game();
    const player = game.getActivePlayer();
    const config = this.getSelfConfig();
    for (const event of config.handlers) game.addCardEvent({ event, source: this });
    if (this.events().init) {
      const { removeEvent } = this.events().init.call(this, { game, player }) || {};
      if (removeEvent) {
        for (const event of config.handlers) game.deleteCardEvent({ event, source: this });
      }
    }
    this.set({ played: Date.now() });
  }
});
