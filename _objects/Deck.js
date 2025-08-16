(class Deck extends lib.game.GameObject {
  itemMap = {};
  #updatedItems = {};
  #itemClass;

  constructor(data, { parent }) {
    super(data, { col: 'deck', parent });
    this.broadcastableFields(['_id', 'code', 'type', 'subtype', 'placement', 'itemMap', 'eventData']);

    const { type, subtype, placement, itemType, settings, access, itemMap, parentDeckId } = data;
    this.set({ type, subtype, placement, itemType, settings, access, itemMap, parentDeckId });
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
          for (const [id, val] of Object.entries(value)) {
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
                  ids[fakeId] = item.prepareFakeData?.(val) || val;
                }
              }
            } else {
              // первичная рассылка из addSubscriber
              const fakeId = item.fakeId[fakeIdParent];
              if (item.visible) {
                ids[id] = val;
                if (fakeId) ids[fakeId] = null;
              } else {
                if (!fakeId) throw '!fakeId';
                ids[fakeId] = item.prepareFakeData?.(val) || val;
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
          for (const [id, val] of Object.entries(value)) {
            if (parent === player || this.access[player?._id] || viewerMode) {
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
                    ids[fakeId] = item.prepareFakeData?.(val) || val;
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
                  ids[fakeId] = item.prepareFakeData?.(val) || val;
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
    const newObjectCreation = item.constructor != itemClass ? true : false; // тут может прийти объект с первичным набором атрибутов

    if (newObjectCreation) {
      // setParent вызовется в конструкторе
      item = new itemClass(item, { parent: this });
    } else {
      item.setParent(this);
    }
    if (!item.sourceDeckId) item.set({ sourceDeckId: parentId });

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
    for (const item of this.items()) {
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
  moveAllItems({ target, setData, emitEvent, markNew, markDelete, toDeck, toDrop }) {
    for (const item of this.items()) {
      if (emitEvent) {
        for (const event of item.eventData.activeEvents) event.emit(emitEvent);
      }

      if (toDeck) item.moveToDeck({ setData });
      else if (toDrop) item.moveToDrop({ setData });
      else item.moveToTarget(target, { markDelete, setData });

      if (markNew) item.markNew();
    }
  }
  moveRandomItems({ count, target, setData }) {
    const items = [];
    for (let i = 0; i < count; i++) {
      const item = this.getRandomItem();
      if (item) {
        item.moveToTarget(target, { setData });
        items.push(item);
      }
    }
    return items;
  }
  items() {
    return this.select(this.getItemClass().name);
  }
  getFirstItem() {
    return this.items()[0];
  }
  getRandomItem({ skipArray = [] } = {}) {
    const items = this.items().filter(({ _id }) => !skipArray.includes(_id));
    const item = items[Math.floor(Math.random() * items.length)];
    return item;
  }
  updateAllItems(updateData) {
    for (const item of this.items()) {
      item.set(lib.utils.clone(updateData));
    }
  }
});
