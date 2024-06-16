(class Card extends lib.game.GameObject {
  constructor(data, { parent }) {
    super(data, { col: 'card', parent });
    this.broadcastableFields(['_id', 'name', 'played', 'disabled', 'eventData']);
    this.publicStaticFields(['group', 'owner']);

    const { title, name, played, disabled } = data;
    this.set({ title, name, played, disabled });
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

  getEvent(eventName) {
    if (!eventName) eventName = this.name;
    const event = domain.game.events?.card?.[eventName] || lib.game.events?.card?.[eventName];
    if (!event) return null;
    return event();
  }
  isPlayOneTime() {
    return this.getEvent()?.config?.playOneTime;
  }
  restoreAvailable() {
    if (this.isPlayOneTime()) {
      return this.played ? false : true;
    } else {
      return true;
    }
  }

  canPlay() {
    return this.getEvent(this.name) ? true : false;
  }
  play({ player, logMsg } = {}) {
    if (this.played) return;
    const event = this.initEvent(this.name, { player });
    if (event !== null && player) player.addEvent(event);
    this.set({ played: Date.now() });
    this.game().logs(logMsg || `Разыграна карта "${this.title}"`);
  }
});
