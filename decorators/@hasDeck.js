({
  decorate: () => ({
    /**
     * @param {*} data
     * @param {object} [config]
     * @param {(import('application/lib/game/types.js').objects.Deck)} config.deckClass
     * @param {string} config.deckListName
     * @returns {(import('application/lib/game/types.js').objects.Deck)}
     */
    addDeck(data, { deckMapName = 'deckMap', deckClass, deckItemClass, parentDirectLink = true } = {}) {
      const { Deck: defaultDeckClass, Card: defaultCardClass } = this.game().defaultClasses();
      if (!deckClass) deckClass = defaultDeckClass;
      if (!deckItemClass) deckItemClass = defaultCardClass;

      if (!data.settings) data.settings = {};
      if (!data.access) data.access = {};
      data.settings.parentDeckContainer = deckMapName;

      /** @type {(import('application/lib/game/types.js').objects.Deck)} */
      const deck = new deckClass(data, { parent: this });

      this.set({ [deckMapName]: { [deck._id]: {} }, decks: {} });
      if (parentDirectLink && deck.subtype) {
        if (!this.decks) this.decks = {};
        this.decks[deck.subtype] = deck;
      }
      deck.setItemClass(deckItemClass);

      if (data.itemMap) {
        data.itemList = [];
        const store = this.getFlattenStore();
        for (const _id of Object.keys(data.itemMap)) data.itemList.push(store[_id]);
      }
      for (const item of data.itemList || []) deck.addItem(item);
      return deck;
    },
    deleteDeck(deckToDelete) {
      deckToDelete.deleteFromParentsObjectStorage();
      const { parentDeckContainer } = deckToDelete.settings;
      this.set({ [parentDeckContainer]: { [deckToDelete._id]: null } });
      if (deckToDelete.subtype) delete this.decks[deckToDelete.subtype];
    },
  }),
});
