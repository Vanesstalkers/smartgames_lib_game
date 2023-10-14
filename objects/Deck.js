(class Deck extends lib.game.GameObject {
  itemMap = {};
  #updatedItems = {};
  #itemClass;

  constructor(data, { parent }) {
    super(data, { col: 'deck', parent });
    this.broadcastableFields(['_id', 'code', 'type', 'subtype', 'placement', 'itemMap']);

    this.set({
      type: data.type,
      subtype: data.subtype,
      cardGroups: data.cardGroups,
      placement: data.placement,
      itemType: data.itemType,
      settings: data.settings,
      access: data.access,
    });
  }
  prepareBroadcastData({ data, player, viewerMode }) {
    let preparedData = {};
    const bFields = this.broadcastableFields();
    const fakeIdParent = this.id();
    const parent = this.getParent();
    const game = this.game();
    if (parent.matches({ className: 'Game' })) {
      for (const [key, value] of Object.entries(data)) {
        if (key === 'itemMap' && !this.access[player?._id] && !viewerMode) {
          const ids = {};
          for (const [idx, [id, val]] of Object.entries(value).entries()) {
            const item = game.getObjectById(id); // ищем в game, потому что item мог быть перемещен
            const updatedItemsEntries = Object.entries(this.#updatedItems[id] || {});
            if (updatedItemsEntries.length) {
              for (const [fakeId, action] of updatedItemsEntries) {
                if (action === 'remove') {
                  ids[id] = null;
                  ids[fakeId] = null;
                } else if (action === 'removeVisible') {
                  ids[id] = null;
                  ids[fakeId] = null; // item могли сначала сделать visible, а потом удалить
                } else if (item.visible) {
                  ids[id] = val;
                  ids[fakeId] = null; // если не удалить, то будет задвоение внутри itemMap на фронте
                } else {
                  ids[fakeId] = val;
                }
              }
            } else {
              // первичная рассылка из addSubscriber
              if (item.visible) {
                ids[id] = val;
              } else {
                const fakeId = item.fakeId[fakeIdParent];
                if (!fakeId) throw '!fakeId';
                ids[fakeId] = val;
              }
            }
          }
          preparedData.itemMap = ids;
        } else {
          if (bFields.includes(key)) preparedData[key] = value;
        }
      }
    } else if (parent.matches({ className: 'Player' })) {
      for (const [key, value] of Object.entries(data)) {
        if (key === 'itemMap') {
          const ids = {};
          for (const [idx, [id, val]] of Object.entries(value).entries()) {
            if (parent === player || viewerMode) {
              ids[id] = val;
            } else {
              const item = game.getObjectById(id); // ищем в game, потому что item мог быть перемещен
              const updatedItemsEntries = Object.entries(this.#updatedItems[id] || {});
              if (updatedItemsEntries.length) {
                for (const [fakeId, action] of updatedItemsEntries) {
                  if (action === 'remove') {
                    ids[id] = null;
                    ids[fakeId] = null;
                  } else if (action === 'removeVisible') {
                    ids[id] = null;
                    ids[fakeId] = null; // item могли сначала сделать visible, а потом удалить
                  } else if (item.visible || viewerMode) {
                    ids[id] = val;
                    ids[fakeId] = null; // если не удалить, то будет задвоение внутри itemMap на фронте
                  } else {
                    ids[fakeId] = val;
                  }
                }
              } else {
                // первичная рассылка из addSubscriber
                const fakeId = item.fakeId[fakeIdParent];
                if (!fakeId) throw '!fakeId';
                if (item.visible || viewerMode) {
                  ids[id] = val;
                  ids[fakeId] = null; // если не удалить, то будет задвоение внутри itemMap на фронте
                } else {
                  ids[fakeId] = val;
                }
              }
            }
          }
          preparedData.itemMap = ids;
        } else {
          if (bFields.includes(key)) preparedData[key] = value;
        }
      }
    } else {
      for (const [key, value] of Object.entries(data)) {
        if (bFields.includes(key)) preparedData[key] = value;
      }
    }

    return { visibleId: this._id, preparedData };
  }
  broadcastDataAfterHandler() {
    // очищаем объект, чтобы в каждую рассылку не отправлять старые изменения
    this.#updatedItems = {};
  }

  customObjectCode({ codeTemplate, replacementFragment }, data) {
    const replaceString = [data.type, data.subtype].filter((item) => item).join('_');
    return codeTemplate.replace(replacementFragment, replaceString);
  }

  setItemClass(itemClass) {
    this.#itemClass = itemClass;
  }
  getItemClass() {
    return this.#itemClass;
  }
  itemsCount() {
    return Object.keys(this.itemMap).length;
  }
  addItem(item) {
    const parentId = this.id();
    const itemClass = this.getItemClass();
    if (item.constructor != itemClass) item = new itemClass(item, { parent: this });

    this.set({ itemMap: { [item._id]: {} } });
    this.addToObjectStorage(item);

    const game = this.game();
    if (!game.checkChangesDisabled()) {
      // фейковые изменения (скорее всего расчет доступных зон) - данные для фронта обновлять не нужно

      item.markNew();
      item.updateFakeId({ parentId });
      this.markItemUpdated({ item, action: 'add' });
    }

    return true;
  }
  removeItem(itemToRemove) {
    this.set({ itemMap: { [itemToRemove._id]: null } });
    this.deleteFromObjectStorage(itemToRemove);

    const game = this.game();
    if (!game.checkChangesDisabled()) {
      // фейковые изменения (скорее всего расчет доступных зон) - данные для фронта обновлять не нужно
      this.markItemUpdated({
        item: itemToRemove,
        action: itemToRemove.visible ? 'removeVisible' : 'remove',
      });
    }
  }
  setItemVisible(item) {
    // чтобы попал в prepareBroadcastData
    this.set({ itemMap: { [item.id()]: null } });
    this.set({ itemMap: { [item.id()]: {} } });
    // чтобы попал в for (const [fakeId, action] of updatedItemsEntries) {...}
    this.markItemUpdated({ item });
    // чтобы попал в ветку if (item.visible) {...}
    item.set({ visible: true });
  }
  /**
   * Наполняем данные для рассылки фронту (о fakeId, которые нужно удалить из deck)
   */
  markItemUpdated({ item, action }) {
    if (!this.#updatedItems[item._id]) this.#updatedItems[item._id] = {};
    this.#updatedItems[item._id][item.fakeId[this.id()]] = action;
  }
  moveAllItems({ target }, updateData) {
    const store = this.getFlattenStore();
    const itemIds = Object.keys(this.itemMap);
    for (const id of itemIds) {
      const item = store[id];
      if (updateData) item.set(updateData);
      item.moveToTarget(target);
    }
  }
  moveRandomItems({ count, target }) {
    for (let i = 0; i < count; i++) {
      const item = this.getRandomItem();
      if (item) item.moveToTarget(target);
    }
  }
  getRandomItem({ skipArray = [] } = {}) {
    const itemIds = Object.keys(this.itemMap).filter((_id) => !skipArray.includes(_id));
    if (itemIds.length === 0) return null;
    const id = itemIds[Math.floor(Math.random() * itemIds.length)];
    const store = this.getFlattenStore();
    return store[id];
  }
  smartMoveRandomCard({ target }) {
    let card = this.getRandomItem();
    if (card) card.moveToTarget(target);
    else {
      this.restoreCardsFromDrop();
      card = this.getRandomItem();
      if (card) card.moveToTarget(target);
    }
    return card;
  }
  restoreCardsFromDrop({ deckDrop } = {}) {
    if (!deckDrop) deckDrop = this.game().getObjectByCode('Deck[card_drop]');
    const cards = deckDrop
      .getObjects({
        className: 'Card',
      })
      .filter(({ group }) => this.cardGroups.includes(group));
    for (const card of cards) {
      if (card.restoreAvailable()) card.moveToTarget(this);
    }
  }
  updateAllItems(updateData) {
    const store = this.getFlattenStore();
    const itemIds = Object.keys(this.itemMap);
    for (const id of itemIds) {
      const item = store[id];
      item.set(updateData);
    }
  }
});
