(function (data) {
  // /** @type {(import('application/domain/game/types.js').default)} */
  // const self = this;

  const store = this.getStore();
  const player = new domain.game.objects.Player(data, { parent: this });
  this.set({ playerMap: { [player._id]: {} } });

  if (data.deckMap) {
    data.deckList = [];
    for (const _id of Object.keys(data.deckMap)) data.deckList.push(store.deck[_id]);
  }
  for (const item of data.deckList || []) {
    /**
     * @type {(
     * import('application/lib/game/types.js').objects.Card
     * )}
     * */
    const deckItemClass = lib.game.objects.Card;

    item.access = { [player._id]: {} };
    player.addDeck(item, { deckItemClass });
  }
});
