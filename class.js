() =>
  class Game extends lib.store.class(lib.game.GameObject, { broadcastEnabled: true }) {
    #logs = {};
    store = {};
    playerMap = {};
    eventListeners = {};
    #broadcastObject = {};
    #broadcastDataAfterHandlers = {};
    #objectsDefaultClasses = {};

    constructor(storeData = {}, gameObjectData = {}) {
      if (!storeData.col) storeData.col = 'game';
      if (!gameObjectData.col) gameObjectData.col = 'game';
      if (storeData.id) storeData._id = storeData.id;
      super(storeData, gameObjectData);

      const { Card, Deck, Player, Viewer } = lib.game._objects;
      this.defaultClasses({ Card, Deck, Player, Viewer });

      this.preventSaveFields(['eventData.activeEvents']);
    }

    isCoreGame() {
      return this === this.game();
    }

    set(val, config = {}) {
      if (!this._col) throw new Error(`set error ('_col' is no defined)`);

      const clonedConfig = lib.utils.structuredClone(config);
      this.setChanges(val, clonedConfig);
      lib.utils.mergeDeep({
        ...{ masterObj: this, target: this, source: val },
        config: { deleteNull: true, ...clonedConfig }, // удаляем ключи с null-значением
      });
    }
    setChanges(val, config) {
      super.setChanges(val, config);
    }
    markNew(obj, { saveToDB = false, changes: changesConfig } = {}) {
      const { _col: col, _id: id } = obj;
      if (saveToDB) {
        // broadcast пройдет после сохранения изменений в БД
        this.setChanges({ store: { [col]: { [id]: obj } } }, changesConfig);
      } else {
        this.addBroadcastObject({ col, id });
      }
    }
    markDelete(obj, { saveToDB = false } = {}) {
      const { _col: col, _id: id } = obj;
      if (saveToDB) {
        this.setChanges({ store: { [col]: { [id]: null } } });
      } else {
        this.deleteBroadcastObject({ col, id });
      }
    }

    addToObjectStorage(obj) {
      super.addToObjectStorage(obj);

      const { _id: id, _col: col } = obj;
      if (!this.store[col]) this.store[col] = {};
      this.store[col][id] = obj;
    }
    deleteFromObjectStorage(obj) {
      super.deleteFromObjectStorage(obj);

      const { _id: id, _col: col } = obj;
      if (this.store[id]) delete this.store[id];
    }

    defaultClasses(map) {
      if (map) Object.assign(this.#objectsDefaultClasses, map);
      return this.#objectsDefaultClasses;
    }

    select(query = {}) {
      if (typeof query === 'string') query = { className: query };
      if (!query.directParent) query.directParent = false; // для game должно искаться по всем объектам
      return super.select(query);
    }

    async create({ deckType, gameType, gameConfig, gameTimer, templates } = {}, { initPlayerWaitEvents = true } = {}) {
      const { structuredClone: clone } = lib.utils;
      const {
        [gameType]: {
          //
          items: { [gameConfig]: settings },
        } = {},
      } = domain.game.configs.gamesFilled();

      if (!settings)
        throw new Error(
          `Not found initial game data (deckType='${deckType}', gameType='${gameType}', gameConfig='${gameConfig}').`
        );

      const gameData = {
        settings: clone(settings),
        addTime: Date.now(),
        ...{ deckType, gameType, gameConfig, gameTimer, templates },
      };
      if (gameTimer)
        gameData.settings.timer = typeof settings.timer === 'function' ? settings.timer(gameTimer) : gameTimer;

      this.run('fillGameData', gameData);
      if (initPlayerWaitEvents) this.run('initPlayerWaitEvents');

      await super.create({ ...this });

      const initiatedGame = await db.redis.hget('games', this.id());
      if (!initiatedGame) await this.addGameToCache();

      return this;
    }
    restore() {
      this.set({ status: 'IN_PROCESS', statusLabel: `Раунд ${this.round}`, addTime: Date.now() });
      this.run('initGameProcessEvents');
      lib.timers.timerRestart(this, this.lastRoundTimerConfig);
    }

    async addGameToCache() {
      await db.redis.hset(
        'games',
        this.id(),
        {
          id: this.id(),
          deckType: this.deckType,
          gameType: this.gameType,
          workerId: application.worker.id,
          port: application.server.port,
        },
        { json: true }
      );
    }
    async updateGameAtCache(data = {}) {
      const game = await db.redis.hget('games', this.id(), { json: true });
      await db.redis.hset('games', this.id(), { ...game, ...data }, { json: true });
    }

    /**
     * Сохраняет данные при получении обновлений
     * @param {*} data
     */
    async processData(data) {
      this.set(data, { removeEmptyObject: true });
      await this.saveChanges();
    }

    /**
     * Обработчики, вынесенные в отдельные файлы (папка actions)
     */
    run(actionPath, data, initPlayer) {
      const [actionName, actionDir] = actionPath.split('.').reverse();

      let action;
      if (actionDir) {
        action = lib.game.actions?.[actionName];
      } else {
        action = domain.game.actions?.[actionName];
        if (!action) action = lib.game.actions?.[actionName];
      }

      if (!action) throw new Error(`action "${actionName}" not found`);

      return action.call(this, data, initPlayer);
    }

    addEventListener({ handler, event }) {
      if (!this.eventListeners[handler]) this.set({ eventListeners: { [handler]: [] } });
      this.set({
        eventListeners: {
          [handler]: this.eventListeners[handler].concat(event),
        },
      });
    }
    removeEventListener({ handler, eventToRemove }) {
      const listeners = this.eventListeners[handler];
      if (!listeners) throw new Error(`listeners not found (handler=${handler})`);

      const eventListeners = {};
      if (eventToRemove) {
        if (handler === 'TRIGGER') eventToRemove.player().removeEventWithTriggerListener();
        else eventListeners[handler] = listeners.filter((event) => event !== eventToRemove);
      }

      this.set({ eventListeners });
    }
    removeAllEventListeners({ sourceId, event: eventToRemove }) {
      const eventListeners = {};
      for (const [handler, listeners] of Object.entries(this.eventListeners)) {
        if (sourceId) eventListeners[handler] = listeners.filter((event) => event.sourceId() !== sourceId);
        if (eventToRemove) {
          if (handler === 'TRIGGER') eventToRemove.player().removeEventWithTriggerListener();
          else eventListeners[handler] = listeners.filter((event) => event !== eventToRemove);
        }
      }

      this.set({ eventListeners });
    }
    toggleEventHandlers(handler, data = {}, initPlayer) {
      if (!this.eventListeners[handler]) return;

      if (!initPlayer) initPlayer = this.roundActivePlayer();
      if (!initPlayer) return; // генерация стартового поля

      for (const event of this.eventListeners[handler]) {
        if (!this.eventListeners[handler].includes(event)) return; // событие могло быть удалено в предыдущих итерациях цикла

        const playerAccessAllowed = event.checkAccess(initPlayer);
        if (!playerAccessAllowed) {
          console.error(`Not playerAccessAllowed for user "${initPlayer?.code}" to handler "${handler}"`);
          continue;
        }

        const { preventListenerRemove } = event.emit(handler, data, initPlayer) || {};
        if (!preventListenerRemove) this.removeEventListener({ handler, eventToRemove: event });
      }
    }
    forceEmitEventHandler(handler, data) {
      if (!this.eventListeners[handler]) return;

      for (const event of this.eventListeners[handler]) {
        const { preventListenerRemove } = event.emit(handler, data) || {};
        if (!preventListenerRemove) this.removeEventListener({ handler, eventToRemove: event });
      }
    }
    clearEvents() {
      for (const handler of Object.keys(this.eventListeners)) {
        this.set({ eventListeners: { [handler]: [] } });
      }
    }

    logs(data, { consoleMsg } = {}) {
      if (!data) return this.#logs;

      if (typeof data === 'string') data = { msg: data };
      if (!data.time) data.time = Date.now();

      if (data.msg.includes('{{player}}')) {
        const player = data.userId
          ? this.players().find(({ userId }) => userId === data.userId)
          : this.roundActivePlayer();
        if (player?.userName) data.msg = data.msg.replace(/{{player}}/g, `<player>${player.userName}</player>`);
      }

      const id = (Date.now() + Math.random()).toString().replace('.', '_');
      this.#logs[id] = data;
      if (consoleMsg) console.info(data.msg);
    }
    async showLogs({ userId, sessionId, lastItemTime }) {
      let logs = this.logs();
      if (lastItemTime) {
        logs = Object.fromEntries(Object.entries(logs).filter(([{ }, { time }]) => time > lastItemTime));
      }
      await this.broadcastData({ logs }, { customChannel: `session-${sessionId}` });
    }

    isSinglePlayer() {
      return this.settings.singlePlayer;
    }

    players() {
      const store = this.getStore();
      return Object.keys(this.playerMap).map((_id) => store.player[_id]);
    }
    getPlayerByUserId(id) {
      return this.players().find((player) => player.userId === id);
    }

    /**
     * PIPELINE_GAME_START (6) :: делаем публикацию о присоединении конкретного игрока к игре
     */
    async playerJoin({ playerId, userId, userName, userAvatar }) {
      try {
        if (this.status === 'FINISHED') throw new Error('Игра уже завершена.');

        const player = playerId ? this.get(playerId) : this.getFreePlayerSlot();
        if (!player) throw new Error('Свободных мест не осталось');
        const gameId = this.id();
        playerId = player.id();

        player.set({ ready: true, userId, userName, avatarCode: userAvatar });
        this.logs({ msg: `Игрок {{player}} присоединился к игре.`, userId });

        // инициатором события был установлен первый player в списке, который совпадает с активным игроком на старте игры
        this.toggleEventHandlers('PLAYER_JOIN', { targetId: playerId }, player);
        await this.saveChanges();

        lib.store.broadcaster.publishAction(`gameuser-${userId}`, 'joinGame', {
          gameId,
          playerId,
          deckType: this.deckType,
          gameType: this.gameType,
          isSinglePlayer: this.isSinglePlayer(),
        });
      } catch (exception) {
        console.error(exception);
        lib.store.broadcaster.publishAction(`user-${userId}`, 'broadcastToSessions', {
          data: { message: exception.message, stack: exception.stack },
        });
        lib.store.broadcaster.publishAction(`gameuser-${userId}`, 'logout'); // инициирует hideGameIframe
      }
    }
    async viewerJoin({ viewerId, userId, userName }) {
      try {
        if (this.status === 'FINISHED') throw new Error('Игра уже завершена.');

        const { Viewer: viewerClass } = this.defaultClasses();
        const viewer = new viewerClass({ _id: viewerId, userId }, { parent: this });
        viewer.set({ userId, userName });
        this.logs({ msg: `Наблюдатель присоединился к игре.` });

        await this.saveChanges();

        lib.store.broadcaster.publishAction(`gameuser-${userId}`, 'joinGame', {
          gameId: this.id(),
          viewerId: viewer.id(),
          deckType: this.deckType,
          gameType: this.gameType,
          isSinglePlayer: this.isSinglePlayer(),
        });
      } catch (exception) {
        console.error(exception);
        lib.store.broadcaster.publishAction(`user-${userId}`, 'broadcastToSessions', {
          data: { message: exception.message, stack: exception.stack },
        });
      }
    }
    async playerLeave({ userId }) {
      if (this.status !== 'FINISHED') {
        this.logs({ msg: `Игрок {{player}} вышел из игры.`, userId });
        try {
          this.run('endGame', { canceledByUser: userId });
        } catch (exception) {
          if (exception instanceof lib.game.endGameException) {
            await this.removeGame();
          } else throw exception;
        }
      }
      lib.store.broadcaster.publishAction(`gameuser-${userId}`, 'leaveGame', {});
    }
    async viewerLeave({ userId, viewerId }) {
      if (this.status !== 'FINISHED') {
        const viewer = this.get(viewerId);
        if (!viewer) return;

        viewer.markDelete({ saveToDB: true });
        this.deleteFromObjectStorage(viewer);
        await this.saveChanges();
      }
      lib.store.broadcaster.publishAction(`gameuser-${userId}`, 'leaveGame', {});
    }
    roundActivePlayer(player) {
      if (player) this.set({ roundActivePlayerId: player.id() });
      return this.get(this.roundActivePlayerId);
    }
    selectNextActivePlayer() {
      const roundActivePlayer = this.roundActivePlayer();
      if (this.round > 0 && roundActivePlayer) {
        this.logs(
          {
            msg: `Игрок {{player}} закончил раунд №${this.round}.`,
            userId: roundActivePlayer.userId,
          },
          { consoleMsg: true }
        );
      }

      if (roundActivePlayer?.eventData.extraTurn) {
        roundActivePlayer.set({ eventData: { extraTurn: null } });
        if (roundActivePlayer.eventData.skipTurn) {
          // актуально только для событий в течение хода игрока, инициированных не им самим
          roundActivePlayer.set({ eventData: { skipTurn: null } });
        } else {
          this.logs({
            msg: `Игрок {{player}} получает дополнительный ход.`,
            userId: roundActivePlayer.userId,
          });
          return roundActivePlayer;
        }
      }

      const playerList = this.players();
      const activePlayerIndex = playerList.findIndex((player) => player === roundActivePlayer);
      const newActivePlayer = playerList[(activePlayerIndex + 1) % playerList.length];
      this.roundActivePlayer(newActivePlayer);

      if (newActivePlayer.eventData.skipTurn) {
        this.logs({
          msg: `Игрок {{player}} пропускает ход.`,
          userId: newActivePlayer.userId,
        });
        newActivePlayer.set({
          eventData: {
            skipTurn: null,
            actionsDisabled: true,
          },
        });
      }

      return newActivePlayer;
    }
    checkWinnerAndFinishGame() {
      let winningPlayer = this.players().sort((a, b) => (a.money > b.money ? -1 : 1))[0];
      if (winningPlayer.money <= 0) winningPlayer = null;
      return this.run('endGame', { winningPlayer });
    }
    setWinner({ player }) {
      this.set({ winUserId: player.userId });
      this.logs({ msg: `Игрок {{player}} победил в игре.`, userId: player.userId });
    }
    getFreePlayerSlot() {
      return this.players().find((player) => !player.ready);
    }
    getActivePlayer() {
      return this.players().find((player) => player.active);
    }
    getActivePlayers() {
      return this.players().filter((player) => player.active);
    }
    activatePlayers({ publishText, setData, disableSkipRoundCheck = false }) {
      for (const player of this.players()) {
        if (!disableSkipRoundCheck && player.skipRoundCheck()) continue;
        player.activate({ setData, publishText });
      }
    }
    checkAllPlayersFinishRound() {
      for (const player of this.players()) {
        if (player.active) return false;
      }
      return true;
    }

    async handleAction({ name: eventName, data: eventData = {}, sessionUserId: userId }) {
      try {
        const player = this.getPlayerByUserId(userId) || this.roundActivePlayer();
        if (!player) throw new Error('player not found');

        const activePlayers = this.getActivePlayers();
        const { disableActivePlayerCheck, disableActionsDisabledCheck } = player.eventData;
        if (!activePlayers.includes(player) && eventName !== 'leaveGame' && !disableActivePlayerCheck)
          throw new Error('Игрок не может совершить это действие, так как сейчас не его ход.');
        else if (
          (this.roundReady || player.eventData.actionsDisabled) &&
          !disableActionsDisabledCheck &&
          eventName !== 'roundEnd' &&
          eventName !== 'leaveGame'
        )
          throw new Error('Игрок не может совершать действия в этот ход.');

        if (disableActivePlayerCheck || disableActionsDisabledCheck) {
          player.set({ eventData: { disableActivePlayerCheck: null, disableActionsDisabledCheck: null } });
        }

        // !!! защитить методы, которые не должны вызываться с фронта
        if (this[eventName]) {
          this[eventName](eventData, player);
        } else {
          this.run(eventName, eventData, player);
        }

        await this.saveChanges();
      } catch (exception) {
        if (exception instanceof lib.game.endGameException) {
          await this.removeGame();
        } else {
          console.error(exception);
          lib.store.broadcaster.publishAction(`gameuser-${userId}`, 'broadcastToSessions', {
            data: { message: exception.message, stack: exception.stack },
          });
        }
      }
    }

    prepareBroadcastData({ data = {}, userId, viewerMode }) {
      const result = {};
      const player = this.getPlayerByUserId(userId);

      for (const [col, ids] of Object.entries(data)) {
        result[col] = {};
        for (const [id, changes] of Object.entries(ids)) {
          if (changes === null) {
            // тут удаление через markDelete
            result[col][id] = null;
          } else if (col === 'game' || changes.fake) {
            result[col][id] = changes;
          } else {
            const obj = this.get(id);
            if (obj && typeof obj.prepareBroadcastData === 'function') {
              const { visibleId, preparedData } = obj.prepareBroadcastData({
                data: changes,
                player,
                viewerMode,
              });
              result[col][visibleId] = preparedData;
              if (typeof obj.broadcastDataAfterHandler === 'function') {
                this.#broadcastDataAfterHandlers[id] = obj.broadcastDataAfterHandler.bind(obj);
              }
            } else result[col][id] = changes;
          }
        }
      }
      return result;
    }

    addBroadcastObject({ col, id }) {
      if (!this.#broadcastObject[col]) this.#broadcastObject[col] = {};
      this.#broadcastObject[col][id] = true;
    }
    deleteBroadcastObject({ col, id }) {
      if (!this.#broadcastObject[col]) this.#broadcastObject[col] = {};
      this.#broadcastObject[col][id] = null;
    }

    /**
     * Дополнительные обработчики для store.broadcastData
     */
    broadcastDataBeforeHandler(data, config = {}) {
      const { customChannel } = config;

      for (const key of this.preventBroadcastFields()) {
        if (data[key]) delete data[key];
      }

      const broadcastObject = !customChannel && this.#broadcastObject;
      if (broadcastObject) {
        for (const col of Object.keys(this.#broadcastObject)) {
          for (const _id of Object.keys(this.#broadcastObject[col])) {
            const objectData =
              this.#broadcastObject[col][_id] === null ? null : lib.utils.structuredClone(this.store[col][_id]);
            lib.utils.mergeDeep({
              target: data,
              source: { store: { [col]: { [_id]: objectData } } },
            });
          }
        }
      }
    }
    broadcastDataAfterHandler(data, config = {}) {
      const { customChannel } = config;

      for (const handler of Object.values(this.#broadcastDataAfterHandlers)) {
        if (typeof handler === 'function') handler();
      }
      this.#broadcastDataAfterHandlers = {};

      const broadcastObject = !customChannel && this.#broadcastObject;
      if (broadcastObject) this.#broadcastObject = {};
    }
    broadcastDataVueStoreRuleHandler(data, { accessConfig }) {
      const { userId, viewerMode } = accessConfig;
      const storeData = data.store
        ? {
          store: this.prepareBroadcastData({ userId, viewerMode, data: lib.utils.structuredClone(data.store) }),
        }
        : {};
      return { ...data, ...storeData };
    }
    async removeGame() {
      await db.redis.hdel('games', this.id());
      await this.saveChanges();
      await this.broadcastData({ logs: this.logs() });
      lib.timers.timerDelete(this);
      this.removeStore();
      this.removeChannel();
      lib.game.flush.list.push(this);
    }

    onTimerRestart({ timerId, data: { time, extraTime = 0 } = {} }) {
      try {
        if (!time) time = this.gameTimer || this.settings.timer.DEFAULT;
        for (const player of this.getActivePlayers()) {
          if (extraTime) {
            player.set({ timerEndTime: (player.timerEndTime || 0) + extraTime * 1000 });
          } else {
            player.set({ timerEndTime: Date.now() + time * 1000 });
          }
          player.set({ timerUpdateTime: Date.now() });
          if (!player.timerEndTime) throw 'player.timerEndTime === NaN';
        }
      } catch (exception) {
        if (exception instanceof lib.game.endGameException) {
          this.removeGame();
        } else throw exception;
      }
    }
    async onTimerTick({ timerId, data: { time = null } = {} }) {
      try {
        if (this.status === 'FINISHED') return lib.timers.timerDelete(this);

        for (const player of this.getActivePlayers()) {
          if (!player.timerEndTime) continue; // сюда попадут "потерянные tick-и" при завершении игры и восстановлении игры

          if (player.timerEndTime < Date.now()) {
            this.toggleEventHandlers('PLAYER_TIMER_END');
            await this.saveChanges();
          }
        }
      } catch (exception) {
        if (exception instanceof lib.game.endGameException) {
          await this.removeGame();
        } else throw exception;
      }
    }
    onTimerDelete({ timerId }) {
      for (const player of this.getActivePlayers()) {
        player.set({
          timerEndTime: null,
          timerUpdateTime: Date.now(),
        });
      }
    }
    async playerUseTutorialLink({ user }) {
      this.logs({ msg: `Игрок {{player}} использовал подсказку и получил прибавку ко времени.`, userId: user._id });
      lib.timers.timerRestart(this, { extraTime: 30 });
      await this.saveChanges();
    }
    async dumpState() {
      const clone = lib.utils.structuredClone(this);
      clone._gameid = db.mongo.ObjectID(clone._id);
      clone._dumptime = Date.now();
      delete clone._id;
      await db.mongo.insertOne(this.col() + '_dump', clone);
    }
    async loadFromDB({ query, fromDump }) {
      const col = this.col();
      const _id = db.mongo.ObjectID(query._id);

      if (!fromDump) return await db.mongo.findOne(col, query);

      query._gameid = _id;
      delete query._id;
      const [
        dumpData, // берем первый элемент, т.к. в ответе массив
      ] = await db.mongo.find(col + '_dump', query, {
        ...{ sort: { round: -1, _dumptime: -1 }, limit: 1 },
      });

      if (!dumpData) throw new Error('Копия для восстановления не найдена.');

      await db.mongo.deleteOne(col, { _id });

      dumpData._id = _id;
      delete dumpData._gameid;
      await db.mongo.insertOne(col, dumpData);

      return dumpData;
    }
  };
