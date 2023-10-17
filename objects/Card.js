(class Card extends lib.game.GameObject {
  constructor(data, { parent }) {
    super(data, { col: 'card', parent });
    this.broadcastableFields(['_id', 'name', 'played', 'disabled', 'eventData', 'activeEvent']);
    this.publicStaticFields(['group']);

    this.set({
      title: data.title,
      name: data.name,
    });
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

  play({ player }) {
    const event = this.initEvent(this.name, { player });
    if (event.hasInitAction()) this.game().logs(`Разыграна карта "${this.title}"`);
    this.set({ played: Date.now() });

    {
      player.set({ activeEvent: event });
      player.activeEvent = event; // пока что нет возможности сохранить ссылку на объект GameEvent (из-за mergeDeep + structuredClone)
    }
  }
});
