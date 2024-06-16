(class Deck extends lib.game.GameObject {
  itemMap = {};
  #updatedItems = {};
  #itemClass;

  constructor(data, { parent }) {
    super(data, { col: 'deck', parent });
    this.broadcastableFields(['_id', 'code', 'type', 'subtype', 'placement', 'itemMap', 'eventData']);

    const { type, subtype, cardGroups, placement, itemType, settings, access } = data;
    this.set({ type, subtype, cardGroups, placement, itemType, settings, access });
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
            const item = game.get(id); // ищем в game, потому что item мог быть перемещен
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
              const item = game.get(id); // ищем в game, потому что item мог быть перемещен
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

    const linkVal = {
      /* addTime: Date.now() */
    }; // addTime может понадобиться в будущем, если nodejs начнет сортировать ключи в объектах по названию (например, тогда перестанет работать порядок переноса item-ов из одной deck в другую)
    const fields = item.publicStaticFields();
    if (fields?.length) {
      for (const key of fields) linkVal[key] = item[key];
    }
    this.set({ itemMap: { [item._id]: linkVal } });

    const game = this.game();
    if (!game.checkChangesDisabled()) {
      // фейковые изменения (скорее всего расчет доступных зон) - данные для фронта обновлять не нужно

      item.markNew();
      item.updateFakeId({ parentId });
      this.markItemUpdated({ item, action: 'add' });
    }

    return item;
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
  removeAllItems() {
    for (const item of this.getAllItems()) {
      this.removeItem(item);
    }
  }
  setItemVisible(item) {
    const itemId = item.id();
    // чтобы попал в prepareBroadcastData
    const linkVal = this.itemMap[itemId];
    this.set({ itemMap: { [itemId]: null } });
    this.set({ itemMap: { [itemId]: linkVal } });
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
  moveAllItems({ target, setData, emitEvent }) {
    for (const item of this.getAllItems()) {
      if (emitEvent) {
        for (const event of item.eventData.activeEvents) event.emit(emitEvent);
      }
      if (setData) item.set(setData);
      item.moveToTarget(target);
    }
  }
  moveRandomItems({ count, target }) {
    for (let i = 0; i < count; i++) {
      const item = this.getRandomItem();
      if (item) item.moveToTarget(target);
    }
  }
  getAllItems() {
    return this.select(this.getItemClass().name);
  }
  getRandomItem({ skipArray = [] } = {}) {
    const items = this.getAllItems().filter(({ _id }) => !skipArray.includes(_id));
    const item = items[Math.floor(Math.random() * items.length)];
    return item;
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
    if (!deckDrop) deckDrop = this.game().decks.drop;
    const cards = deckDrop.select('Card').filter(({ group }) => this.cardGroups.includes(group));
    for (const card of cards) {
      if (card.restoreAvailable()) card.moveToTarget(this);
    }
  }
  updateAllItems(updateData) {
    for (const item of this.getAllItems()) {
      item.set(lib.utils.clone(updateData));
    }
  }
});
