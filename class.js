() =>
  class Game extends lib.store.class(lib.game.GameObject, { broadcastEnabled: true }) {
    #logs = {};
    store = {};
    playerMap = {};
    #broadcastObject = {};
    #broadcastDataAfterHandlers = {};
    #objectsDefaultClasses = {};

    constructor() {
      const storeData = { col: 'game' };
      const gameObjectData = { col: 'game' };
      super(storeData, gameObjectData);

      this.defaultClasses({
        Player: lib.game.objects.Player,
        Viewer: lib.game.objects.Viewer,
        Deck: lib.game.objects.Deck,
        Card: lib.game.objects.Card,
      });
    }

    defaultClasses(map) {
      if (map) Object.assign(this.#objectsDefaultClasses, map);
      return this.#objectsDefaultClasses;
    }

    async create({ deckType, gameType, gameConfig, gameTimer } = {}) {
      const { structuredClone: clone } = lib.utils;
      const {
        [gameType]: {
          //
          items: { [gameConfig]: settings },
        } = {},
      } = domain.game.configs.filledGames;

      if (!settings)
        throw new Error(
          `Not found initial game data (deckType='${deckType}', gameType='${gameType}', gameConfig='${gameConfig}').`
        );

      const gameData = {
        settings: clone(settings),
        addTime: Date.now(),
        ...{ deckType, gameType, gameConfig, gameTimer },
      };
      if (gameTimer)
        gameData.settings.timer = typeof settings.timer === 'function' ? settings.timer(gameTimer) : gameTimer;

      this.run('fillGameData', { data: gameData, newGame: true });
      delete this._id; // удаляем _id от gameObject, чтобы он не попал в БД

      await super.create({ ...this });

      const initiatedGame = await db.redis.hget('games', this.id());
      if (!initiatedGame) await this.addGameToCache();

      return this;
    }
    async load({ fromData = null, fromDB = {} }, { initStore = true } = {}) {
      if (fromData) {
        Object.assign(this, fromData);
      } else {
        let { id, query } = fromDB;
        if (!query && id) query = { _id: db.mongo.ObjectID(id) };
        if (query) {
          const dbData = await db.mongo.findOne(this.col(), query);
          if (dbData === null) {
            throw 'not_found';
          } else {
            this.run('fillGameData', { data: dbData, newGame: false });
            if (!this.id() && initStore) {
              this.initStore(dbData._id);
              if (!this.channel()) this.initChannel();
            }
          }
        }
      }
      if (this._id) delete this._id; // не должно мешаться при сохранении в mongoDB
      return this;
    }

    async addGameToCache() {
      await db.redis.hset(
        'games',
        this.id(),
        {
          id: this.id(),
          deckType: this.deckType,
          workerId: application.worker.id,
          port: application.server.port,
        },
        { json: true }
      );
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
    run(actionName, data, initPlayer) {
      const action = domain.game.actions?.[actionName] || lib.game.actions?.[actionName];
      if (!action) throw new Error(`action "${actionName}" not found`);
      return action.call(this, data, initPlayer);
    }
    runSuper(actionName, data, initPlayer) {
      const action = lib.game.actions?.[actionName];
      if (!action) throw new Error(`action "${actionName}" not found`);
      return action.call(this, data, initPlayer);
    }

    eventListeners = {};
    addEventListener({ handler, event }) {
      if (!this.eventListeners[handler]) this.set({ eventListeners: { [handler]: [] } });
      this.set({
        eventListeners: {
          [handler]: this.eventListeners[handler].concat(event),
        },
      });
    }
    removeEventListener({ handler, sourceId }) {
      const listeners = this.eventListeners[handler];
      if (!listeners) throw new Error(`listeners not found (handler=${handler})`);
      this.set({
        eventListeners: {
          [handler]: listeners.filter((event) => event.sourceId() !== sourceId),
        },
      });
    }
    removeAllEventListeners({ sourceId }) {
      const eventListeners = {};
      for (const [handler, listeners] of Object.entries(this.eventListeners)) {
        eventListeners[handler] = listeners.filter((event) => event.sourceId() !== sourceId);
      }

      this.set({ eventListeners });
    }
    toggleEventHandlers(handler, data = {}, initPlayers) {
      if (!this.eventListeners[handler]) return;

      if (!initPlayers) initPlayers = [this.game().getActivePlayer()];
      if (!Array.isArray(initPlayers)) initPlayers = [initPlayers];
      for (const event of this.eventListeners[handler]) {
        const playerAccessAllowed = initPlayers.includes(event.player());
        if (!playerAccessAllowed) continue;

        const { preventListenerRemove } = event.emit(handler, data) || {};
        if (!preventListenerRemove) this.removeEventListener({ handler, sourceId: event.sourceId() });
      }
    }
    clearEvents() {
      for (const handler of Object.keys(this.eventListeners)) {
        this.set({ eventListeners: { [handler]: [] } });
      }
    }
    triggerEventEnabled() {
      return this.eventListeners['TRIGGER']?.length ? true : false;
    }

    logs(data, { consoleMsg } = {}) {
      if (!data) return this.#logs;

      if (typeof data === 'string') data = { msg: data };
      if (!data.time) data.time = Date.now();

      if (data.msg.includes('{{player}}')) {
        const player = data.userId
          ? this.players().find(({ userId }) => userId === data.userId)
          : this.getActivePlayer();
        if (player?.userName) data.msg = data.msg.replace(/{{player}}/g, `"${player.userName}"`);
      }

      const id = (Date.now() + Math.random()).toString().replace('.', '_');
      this.#logs[id] = data;
      if (consoleMsg) console.info(data.msg);
    }
    async showLogs({ userId, sessionId, lastItemTime }) {
      let logs = this.logs();
      if (lastItemTime) {
        logs = Object.fromEntries(Object.entries(logs).filter(([{}, { time }]) => time > lastItemTime));
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
    async playerJoin({ userId, userName }) {
      try {
        if (this.status === 'FINISHED') throw new Error('Игра уже завершена.');

        const player = this.getFreePlayerSlot();
        if (!player) throw new Error('Свободных мест не осталось');
        const gameId = this.id();
        const playerId = player.id();

        player.set({ ready: true, userId, userName });
        this.logs({ msg: `Игрок {{player}} присоединился к игре.`, userId });

        this.toggleEventHandlers('PLAYER_JOIN', { targetId: playerId });
        await this.saveChanges();

        lib.store.broadcaster.publishAction(`gameuser-${userId}`, 'joinGame', {
          gameId,
          playerId,
          deckType: this.deckType,
          isSinglePlayer: this.isSinglePlayer(),
        });
      } catch (exception) {
        lib.store.broadcaster.publishAction(`user-${userId}`, 'broadcastToSessions', {
          data: { message: exception.message, stack: exception.stack },
        });
      }
    }
    async viewerJoin({ userId, userName }) {
      try {
        if (this.status === 'FINISHED') throw new Error('Игра уже завершена.');

        const { Viewer: viewerClass } = this.defaultClasses();
        const viewer = new viewerClass({ userId }, { parent: this });
        viewer.set({ userId, userName });
        this.logs({ msg: `Наблюдатель присоединился к игре.` });

        await this.saveChanges();

        lib.store.broadcaster.publishAction(`gameuser-${userId}`, 'joinGame', {
          gameId: this.id(),
          viewerId: viewer.id(),
          deckType: this.deckType,
          isSinglePlayer: this.isSinglePlayer(),
        });
      } catch (exception) {
        lib.store.broadcaster.publishAction(`user-${userId}`, 'broadcastToSessions', {
          data: { message: exception.message, stack: exception.stack },
        });
      }
    }
    async playerLeave({ userId, viewerId }) {
      if (this.status !== 'FINISHED' && !viewerId) {
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
    changeActivePlayer({ player } = {}) {
      const activePlayer = this.getActivePlayer();
      if (activePlayer.eventData.extraTurn) {
        activePlayer.set({ eventData: { extraTurn: null } });
        if (activePlayer.eventData.skipTurn) {
          // актуально только для событий в течение хода игрока, инициированных не им самим
          activePlayer.set({ eventData: { skipTurn: null } });
        } else {
          this.logs({
            msg: `Игрок {{player}} получает дополнительный ход.`,
            userId: activePlayer.userId,
          });
          return activePlayer;
        }
      }

      const playerList = this.players();
      let activePlayerIndex = playerList.findIndex((player) => player === activePlayer);
      let newActivePlayer = playerList[(activePlayerIndex + 1) % playerList.length];
      if (player) {
        if (player.eventData.skipTurn) player.set({ eventData: { skipTurn: null } });
        newActivePlayer = player;
      } else {
        if (this.isSinglePlayer()) {
          newActivePlayer.set({ eventData: { actionsDisabled: null } });
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
        } else {
          while (newActivePlayer.eventData.skipTurn) {
            this.logs({
              msg: `Игрок {{player}} пропускает ход.`,
              userId: newActivePlayer.userId,
            });
            newActivePlayer.set({ eventData: { skipTurn: null } });
            activePlayerIndex++;
            newActivePlayer = playerList[(activePlayerIndex + 1) % playerList.length];
          }
        }
      }

      activePlayer.set({ active: false });
      newActivePlayer.set({ active: true });

      return newActivePlayer;
    }

    async handleAction({ name: eventName, data: eventData = {}, sessionUserId: userId }) {
      try {
        const player = this.players().find((player) => player.userId === userId);
        if (!player) throw new Error('player not found');

        const activePlayer = this.getActivePlayer();
        if (player._id !== activePlayer._id && eventName !== 'leaveGame')
          throw new Error('Игрок не может совершить это действие, так как сейчас не его ход.');
        else if (activePlayer.eventData.actionsDisabled && eventName !== 'endRound' && eventName !== 'leaveGame')
          throw new Error('Игрок не может совершать действия в этот ход.');

        // !!! защитить методы, которые не должны вызываться с фронта
        const result = this.run(eventName, eventData, activePlayer);

        await this.saveChanges();

        // не используется
        // const { clientCustomUpdates } = result || {};
        // if (clientCustomUpdates) {
        //   lib.store.broadcaster.publishAction(`user-${userId}`, 'broadcastToSessions', {
        //     type: 'db/smartUpdated',
        //     data: clientCustomUpdates,
        //   });
        // }
      } catch (exception) {
        if (exception instanceof lib.game.endGameException) {
          await this.removeGame();
        } else {
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
            store: this.prepareBroadcastData({ userId, viewerMode, data: data.store }),
          }
        : {};
      return { ...data, ...storeData };
    }
    async removeGame() {
      await db.redis.hdel('games', this.id());
      await this.saveChanges();
      await this.broadcastData({ logs: this.logs() });
      this.remove();
    }

    onTimerRestart({ timerId, data: { time = this.settings.timer, extraTime = 0 } = {} }) {
      const player = this.getActivePlayer();
      if (extraTime) {
        player.set({ timerEndTime: (player.timerEndTime || 0) + extraTime * 1000 });
      } else {
        player.set({ timerEndTime: Date.now() + time * 1000 });
      }
      player.set({ timerUpdateTime: Date.now() });
      if (!player.timerEndTime) throw 'player.timerEndTime === NaN';
    }
    async onTimerTick({ timerId, data: { time = null } = {} }) {
      try {
        if (this.status === 'FINISHED') {
          console.debug("!!! lib.timers.timerDelete on this.status === 'FINISHED'");
          return lib.timers.timerDelete(this);
        }

        const player = this.getActivePlayer();
        if (!player.timerEndTime) throw 'player.timerEndTime === NaN';

        if (player.timerEndTime < Date.now()) {
          this.eventListeners['PLAYER_TIMER_END'].reverse(); // глобальные события игры, добавленные при ее создании, должны отработать последними
          this.toggleEventHandlers('PLAYER_TIMER_END');
          await this.saveChanges();
        }
      } catch (exception) {
        if (exception instanceof lib.game.endGameException) {
          await this.removeGame();
        } else throw exception;
      }
    }
    onTimerDelete({ timerId }) {
      const player = this.getActivePlayer();
      player.set({
        timerEndTime: null,
        timerUpdateTime: Date.now(),
      });
    }
  };
