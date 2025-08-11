(function (data) {
  const store = this.getStore();
  const { Player: playerClass, Card: deckItemClass } = this.defaultClasses();
  const player = new playerClass(data, { parent: this });
  this.set({ playerMap: { [player._id]: {} } });

  if (data.deckMap) {
    data.deckList = [];
    for (const _id of Object.keys(data.deckMap)) data.deckList.push(store.deck[_id]);
  }
  for (const item of data.deckList || []) {
    item.access = { [player._id]: {} };
    player.addDeck(item, { deckItemClass });
  }

  return player;
});
