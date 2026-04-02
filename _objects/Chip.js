(class Chip extends lib.game.GameObject {
  constructor(data, { parent }) {
    super(data, { col: 'chip', parent });
    this.broadcastableFields(['_id', 'name', 'played', 'disabled', 'eventData', 'subtype', 'value', 'ownerId']);
    this.publicStaticFields(['group', 'owner']);

    const { value, title, name, event, subtype } = data;
    const { playOneTime, played, disabled, sourceDeckId, group, owner, ownerId } = data;

    this.set({
      ...{ value, title, name, event, subtype },
      ...{ playOneTime, played, disabled, sourceDeckId, group, owner, ownerId },
    });
  }

  getTitle() {
    return this.title || this.name;
  }

  moveToDeck({ setData } = {}) {
    if (!this.sourceDeckId) throw new Error('sourceDeckId not exists');

    const deck = this.game().get(this.sourceDeckId);
    if (!deck) throw new Error('source deck not exists');

    this.moveToTarget(deck, { markDelete: true, setData });
  }

  moveToDrop({ setData } = {}) {
    const game = this.game();

    const deck = game.get(this.sourceDeckId);
    if (!deck.dropDeckId) throw new Error('dropDeckId not exists');

    const dropDeck = game.get(deck.dropDeckId);
    if (!dropDeck) throw new Error('drop deck not exists');

    this.moveToTarget(dropDeck, { markDelete: true, setData });
  }

  moveToTarget(target, { markDelete = false, setData, setVisible } = {}) {
    const currentParent = this.getParent();
    currentParent.removeItem(this);

    const fields = this.publicStaticFields();
    if (setData && fields?.length) {
      for (const key of fields) {
        if (setData[key] !== undefined) this.set({ [key]: setData[key] });
      }
    }

    const moveResult = target.addItem(this);

    if (moveResult) {
      this.updateParent(target);

      if (markDelete) this.markDelete();
      if (setData) this.set(setData);
      if (setVisible) target.setItemVisible(this);
    } else {
      currentParent.addItem(this);
    }
    return moveResult;
  }

  getEvent(eventName) {
    if (!eventName) eventName = this.name;
    const event = domain.game.events?.chip?.[eventName] || lib.game.events?.chip?.[eventName];
    if (!event) return null;
    return event();
  }

  restoreAvailable() {
    if (this.playOneTime) {
      return this.played ? false : true;
    }
    return true;
  }

  play({ player, logMsg } = {}) {
    if (this.played) return;
    const eventName = this.event?.name || this.name;
    if (!this.getEvent(eventName)) return;

    this.game().logs({
      msg: logMsg || `Разыграна фишка "<a>${this.getTitle()}</a>"`,
      userId: player.userId,
    });

    const event = this.initEvent(eventName, {
      game: player.game(),
      player,
      allowedPlayers: [player],
      initData: this.event,
    });

    if (event) event.name = this.getTitle();
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

  /** Кадр в горизонтальном спрайте на фронте (1…N). */
  setFrame(frameIndex) {
    const n = Number.isFinite(Number(frameIndex)) ? Math.trunc(Number(frameIndex)) : 1;
    this.set({ value: Math.max(1, n) });
  }
});
