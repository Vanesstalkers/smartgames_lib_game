(class Card extends lib.game.GameObject {
  constructor(data, { parent }) {
    super(data, { col: 'card', parent });
    this.broadcastableFields(['_id', 'name', 'played', 'disabled', 'eventData']);
    this.publicStaticFields(['group', 'owner']);

    const { title, name, playOneTime, played, disabled } = data;
    this.set({ title, name, playOneTime, played, disabled });
  }

  getTitle() {
    return this.title || this.name;
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
  restoreAvailable() {
    if (this.playOneTime) {
      return this.played ? false : true;
    } else {
      return true;
    }
  }

  play({ player, logMsg } = {}) {
    if (this.played) return;
    if (!this.getEvent(this.name)) return;

    this.game().logs({ msg: logMsg || `Разыграна карта "<a>${this.title}</a>"`, userId: player.userId });

    const event = this.initEvent(this.name, { game: player.game(), player, allowedPlayers: [player] });

    if (event) event.name = this.title;
    if (event !== null && player) player.addEvent(event);

    this.set({ played: Date.now() });
  }

  returnToHand({ player }) {
    const deck = player.decks[this.group];
    if (deck) this.moveToTarget(deck);

    this.set({
      ...{ visible: null, played: null },
      eventData: {
        ...{ canReturn: null, playDisabled: null, cardClass: null, restoreState: null },
        ...this.eventData.restoreState,
      },
    });
  }
});
