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
      if (!this._col) throw new Error('set error (\'_col\' is no defined)');

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

      const { _id: id } = obj;
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

    async create(
      { deckType, gameType, gameConfig, gameTimer, difficulty, templates, maxPlayersInGame, minPlayersToStart } = {},
      { initPlayerWaitEvents = true } = {}
    ) {
      const { structuredClone: clone } = lib.utils;
      const {
        [gameType]: {
          //
          items: { [gameConfig]: settings },
        } = {},
      } = lib.game.actions.getFilledGamesConfigs();

      if (!settings)
        throw new Error(
          `Not found initial game data (deckType='${deckType}', gameType='${gameType}', gameConfig='${gameConfig}').`
        );

      maxPlayersInGame = maxPlayersInGame?.val || settings.playerList.length;
      if (!minPlayersToStart) minPlayersToStart = settings.minPlayersToStart || settings.playerList.length;

      const gameData = {
        newGame: true,
        settings: clone(settings),
        addTime: Date.now(),
        ...{ deckType, gameType, gameConfig, gameTimer, difficulty, templates, maxPlayersInGame, minPlayersToStart },
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
    restart() {
      this.set({ status: 'IN_PROCESS' });
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
      await db.redis.hset('games', this.id(), { ...(game || {}), ...data }, { json: true });
    }

    /**
     * Сохраняет данные при получении обновлений
     * @param {*} data
     */
    async processData(data) {
      for (const [key, map] of Object.entries(data)) {
        switch (key) {
        case 'user': {
          const userMap = {};

          for (const [userId, user] of Object.entries(map)) {
            const { name, login, avatarCode } = user;
            const userName = name || login;

            const player = this.getPlayerByUserId(userId);
            if (player) player.set({ userName, avatarCode }); // мог быть удален

            userMap[userId] = { userName, avatarCode };
          }

          this.broadcastData({ user: userMap }, { wrapperDisabled: true });
          break;
        }
        default:
          this.set(data, { removeEmptyObject: true });
        }
      }
      await this.saveChanges();
    }

    run(actionPath, data, initPlayer) {
      const [actionName, actionDir] = actionPath.split('.').reverse();

      let action;
      if (actionDir) {
        if (actionDir === 'domain') action = domain.game.actions?.[actionName];
        if (!action) action = lib.game.actions?.[actionName];
      } else {
        action =
          domain.game.actions[this.gameType]?.[actionName] ||
          domain.game[this.gameType]?.actions?.[actionName] ||
          domain.game.actions[actionName] ||
          lib.game.actions[actionName];
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
      const eventPlayers = this.eventListeners[handler].map((e) => e.player()).filter((_) => _);

      if (!initPlayer) initPlayer = this.roundActivePlayer();
      if (!initPlayer && !eventPlayers.length) return; // ожидание игрока и генерация стартового поля

      const result = [];
      for (const event of this.eventListeners[handler]) {
        if (!this.eventListeners[handler].includes(event)) {
          // событие могло быть удалено в предыдущих итерациях цикла
          return;
        }

        const player = initPlayer || event.player();
        const playerAccessAllowed = event.checkAccess(player, { handler });
        if (!playerAccessAllowed) {
          console.error(
            `Not playerAccessAllowed for user "${player?.code}" to handler "${handler}" in "${event.name}" event.`
          );
          result.push({ error: 'access_not_allowed' });
          continue;
        }

        const handlerResult = event.emit(handler, data, player) || {};
        const { preventListenerRemove } = handlerResult;
        if (!preventListenerRemove) this.removeEventListener({ handler, eventToRemove: event });

        result.push(handlerResult);
      }

      return result;
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
        const player = data.userId ?
          this.players().find((player) => player.userId === data.userId) :
          this.roundActivePlayer();
        if (player?.userName) data.msg = data.msg.replace(/{{player}}/g, `<player>${player.userName}</player>`);
      }

      const id = (Date.now() + Math.random()).toString().replace('.', '_');
      this.#logs[id] = data;
      if (consoleMsg) console.info(data.msg);
    }
    async showLogs({ sessionId, lastItemTime }) {
      let logs = this.logs();
      if (lastItemTime) {
        logs = Object.fromEntries(Object.entries(logs).filter((item) => item[1].time > lastItemTime));
      }
      await this.broadcastData({ logs }, { customChannel: `session-${sessionId}` });
    }

    isSinglePlayer() {
      return this.settings.singlePlayer;
    }

    players({ ai = false, readyOnly = true } = {}) {
      const store = this.getStore();
      const result = Object.keys(this.playerMap).map((_id) => store.player[_id]);
      if (ai) return result.filter((player) => player.ai);
      return readyOnly ? result.filter((player) => player.ready) : result;
    }
    getPlayerByUserId(id) {
      return this.players({ readyOnly: false }).find((player) => player.userId === id);
    }

    async playerJoin({ playerId, userId, userName, userAvatar }) {
      try {
        if (this.status === 'FINISHED') throw new Error('Игра уже завершена.');

        const player = playerId ? this.get(playerId) : this.getFreePlayerSlot();
        if (!player) throw new Error('Свободных мест не осталось');
        const gameId = this.id();
        playerId = player.id();

        player.set({ userId, userName, avatarCode: userAvatar });
        this.logs({ msg: 'Игрок {{player}} присоединился к игре.', userId });

        /* инициатором события был установлен первый player в списке,
        который совпадает с активным игроком на старте игры */
        this.toggleEventHandlers('PLAYER_JOIN', { targetId: playerId }, player);

        if (this.gameConfig === 'ai') {
          const player = this.restorationMode
            ? this.players({ readyOnly: false }).find((p) => p.ai)
            : this.getFreePlayerSlot();

          player.set({
            ai: true,
            aiActions: [],
            ready: true,
            userId: 'fake',
            userName: 'fakeName',
            avatarCode: 'fakeAvatar',
          });
          this.logs({ msg: 'Игрок-компьютер {{player}} присоединился к игре.', userId: 'fake' });
          this.toggleEventHandlers('PLAYER_JOIN', { targetId: player.id() }, player);
        }

        await this.saveChanges();

        lib.store.broadcaster.publishAction.call(this, `gameuser-${userId}`, 'joinGame', {
          ...{ gameId, playerId, deckType: this.deckType, gameType: this.gameType },
          isSinglePlayer: this.isSinglePlayer(),
        });
      } catch (exception) {
        console.error(exception);
        lib.store.broadcaster.publishAction.call(this, `user-${userId}`, 'broadcastToSessions', {
          data: { message: exception.message, stack: exception.stack },
        });
        lib.store.broadcaster.publishAction.call(this, `gameuser-${userId}`, 'logout'); // инициирует hideGameIframe
      }
    }
    async viewerJoin({ viewerId, userId, userName }) {
      try {
        if (this.status === 'FINISHED') throw new Error('Игра уже завершена.');

        const { Viewer: ViewerClass } = this.defaultClasses();
        const viewer = new ViewerClass({ _id: viewerId, userId }, { parent: this });
        viewer.set({ userId, userName, eventData: { controlBtn: { label: 'Выйти из игры', leaveGame: true } } });

        this.logs({ msg: 'Наблюдатель присоединился к игре.' });

        await this.saveChanges();

        lib.store.broadcaster.publishAction.call(this, `gameuser-${userId}`, 'joinGame', {
          gameId: this.id(),
          viewerId: viewer.id(),
          deckType: this.deckType,
          gameType: this.gameType,
          isSinglePlayer: this.isSinglePlayer(),
          checkTutorials: false,
        });
      } catch (exception) {
        console.error(exception);
        lib.store.broadcaster.publishAction.call(this, `user-${userId}`, 'broadcastToSessions', {
          data: { message: exception.message, stack: exception.stack },
        });
      }
    }
    async playerLeave({ userId }) {
      if (this.status !== 'FINISHED') {
        this.logs({ msg: 'Игрок {{player}} вышел из игры.', userId });
        try {
          this.run('endGame', { canceledByUser: userId });
        } catch (exception) {
          if (exception instanceof lib.game.endGameException) {
            await this.removeGame();
          } else throw exception;
        }
      }
      lib.store.broadcaster.publishAction.call(this, `gameuser-${userId}`, 'leaveGame', {});
    }
    async viewerLeave({ userId, viewerId }) {
      if (this.status !== 'FINISHED') {
        const viewer = this.get(viewerId);
        if (!viewer) return;

        viewer.markDelete({ saveToDB: true });
        this.deleteFromObjectStorage(viewer);
        await this.saveChanges();
      }
      lib.store.broadcaster.publishAction.call(this, `gameuser-${userId}`, 'leaveGame', {});
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
            msg: `Игрок {{player}} закончил раунд №${this.round}`,
            userId: roundActivePlayer.userId,
          },
          { consoleMsg: true }
        );
      }

      if (roundActivePlayer?.eventData?.extraTurn) {
        roundActivePlayer.set({ eventData: { extraTurn: null } });
        if (
          roundActivePlayer.eventData.skipTurn ||
          roundActivePlayer.ready !== true // игрок мог выйти
        ) {
          // актуально только для событий в течение хода игрока, инициированных не им самим
          roundActivePlayer.set({ eventData: { skipTurn: null } });
        } else {
          this.logs({
            msg: 'Игрок {{player}} получает дополнительный ход.',
            userId: roundActivePlayer.userId,
          });
          return roundActivePlayer;
        }
      }

      const playerList = this.players();
      const activePlayerIndex = playerList.findIndex((player) => player === roundActivePlayer);
      const newActivePlayer = playerList[(activePlayerIndex + 1) % playerList.length];
      this.roundActivePlayer(newActivePlayer);

      if (newActivePlayer?.eventData?.skipTurn) {
        this.logs({
          msg: 'Игрок {{player}} пропускает ход.',
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
      this.logs({ msg: 'Игрок {{player}} победил в игре.', userId: player.userId });
    }
    getFreePlayerSlot() {
      return this.players({ readyOnly: false }).find((player) => !player.userId);
    }
    getActivePlayer() {
      return this.players({ readyOnly: false }).find((player) => player.active);
    }
    getActivePlayers() {
      return this.players({ readyOnly: false }).filter((player) => player.active);
    }
    activatePlayers({ notifyUser, setData, disableSkipTurnCheck = false }) {
      for (const player of this.players()) {
        if (!disableSkipTurnCheck && player.eventData.skipTurn) {
          this.logs({ msg: 'Игрок {{player}} пропускает ход.', userId: player.userId });
          player.set({ eventData: { skipTurn: null } });
          continue;
        }
        player.activate({ setData, notifyUser });
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
          lib.store.broadcaster.publishAction.call(this, `gameuser-${userId}`, 'broadcastToSessions', {
            data: { message: exception.message, stack: exception.stack },
          });
          await this.saveChanges();
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
      const storeData = data.store ?
        { store: this.prepareBroadcastData({ userId, viewerMode, data: lib.utils.structuredClone(data.store) }) } : {};
      return { ...data, ...storeData };
    }
    async removeGame({ preventDeleteDumps = false } = {}) {
      await db.redis.hdel('games', this.id());
      await this.saveChanges();
      await this.broadcastData({ logs: this.logs() });
      lib.timers.timerDelete(this);
      this.removeStore();
      this.removeChannel();
      lib.game.flush.list.push(this);
      await db.mongo.deleteOne(this.col(), { _id: this.id() });
      if (!preventDeleteDumps) {
        await db.mongo.deleteMany(this.col() + '_dump', { _gameid: db.mongo.ObjectID(this.id()) });
      }
    }

    onTimerRestart({ data: { time, extraTime = 0 } = {} }) {
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
    async onTimerTick() {
      try {
        if (this.status === 'FINISHED') return lib.timers.timerDelete(this);

        for (const player of this.getActivePlayers()) {
          if (!player.timerEndTime) {
            // сюда попадут "потерянные tick-и" при завершении игры и восстановлении игры
            continue;
          }

          if (player.timerEndTime < Date.now()) {
            this.toggleEventHandlers('PLAYER_TIMER_END', {}, player);
            await this.saveChanges();
          }
        }
      } catch (exception) {
        if (exception instanceof lib.game.endGameException) {
          await this.removeGame();
        } else throw exception;
      }
    }
    onTimerDelete() {
      for (const player of this.getActivePlayers()) {
        player.set({
          timerEndTime: null,
          timerUpdateTime: Date.now(),
        });
      }
    }
    async playerUseTutorial({ userId, usedLink }) {
      if (usedLink) {
        this.getPlayerByUserId(userId).notifyUser(
          'Для повторного использования подсказки <a>зажми Ctrl</a> и выбери её снова'
        );
      }

      const roundActivePlayer = this.getPlayerByUserId(userId)?.active;
      if (!roundActivePlayer) return; // даем прибавку только игрокам, у которых запущен таймер

      this.logs({ msg: 'Игрок {{player}} использовал подсказку и получил прибавку ко времени.', userId });
      lib.timers.timerRestart(this, { extraTime: 30 });
      await this.saveChanges();
    }
    updateTimerOverdueCounter(timerOverdue) {
      let timerOverdueCounter = this.timerOverdueCounter || 0;
      if (timerOverdue) {
        timerOverdueCounter++;
        // если много ходов было завершено по таймауту, то скорее всего все игроки вышли и ее нужно завершать
        if (timerOverdueCounter > this.settings.autoFinishAfterRoundsOverdue) {
          console.error('endGame <- timerOverdue');
          this.run('endGame');
        }
      } else {
        timerOverdueCounter = 0;
      }
      this.set({ timerOverdueCounter });
    }
    prepareRoundObject(obj = {}) {
      if (!this.rounds) this.rounds = {};

      const GAME_SYMBOL = Symbol('_game');
      obj[GAME_SYMBOL] = this;
      if (!obj._data) obj._data = {};

      const round = new Proxy(obj, {
        set(target, prop, value) {
          if (prop === '_data' || prop === GAME_SYMBOL) return false;

          const id = value?.id?.();

          if (id) {
            target._data[prop] = id;
          } else {
            target[prop] = value;
            delete target._data[prop];
          }

          return true;
        },

        get(target, prop) {
          const data = target._data;
          return prop in data ? target[GAME_SYMBOL].get(data[prop]) : target[prop];
        },

        deleteProperty(target, prop) {
          if (prop === '_data' || prop === GAME_SYMBOL) return false;

          if (prop in target._data) delete target._data[prop];
          if (prop in target) delete target[prop];

          return true;
        },
      });

      Object.defineProperty(round, 'save', {
        value: () => {
          const currentValue = lib.utils.structuredClone(round);
          const previousValue = round._previousValue || {};
          round._previousValue = currentValue;
          this.set({ rounds: { [this.round]: round } }, { masterObject: previousValue });
        },
        writable: false,
        enumerable: false,
        configurable: false,
      });

      Object.defineProperty(round, '_previousValue', {
        value: {},
        writable: true,
        enumerable: false,
        configurable: false,
      });

      return (this.rounds[this.round] = round);
    }
    async saveChanges() {
      if (this.rounds) {
        const round = this.rounds[this.round];
        round.save();
      }

      await super.saveChanges();
    }
  };
