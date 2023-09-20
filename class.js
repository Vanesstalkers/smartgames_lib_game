() =>
  class Game extends lib.store.class(lib.game.GameObject, { broadcastEnabled: true }) {
    #logs = {};
    store = {};
    playerMap = {};
    #broadcastObject = {};
    #broadcastDataAfterHandlers = {};

    constructor() {
      const storeData = { col: 'game' };
      const gameObjectData = { col: 'game' };
      super(storeData, gameObjectData);
    }

    async create({ deckType, gameType, gameConfig, gameTimer } = {}) {
      const { structuredClone: clone } = lib.utils;

      const gameTypeSettings = domain.game.configs.games[gameType];
      const settingsJSON = gameTypeSettings?.[gameConfig];
      if (!settingsJSON)
        throw new Error(
          `Not found initial game data (deckType='${deckType}', gameType='${gameType}', gameConfig='${gameConfig}').`
        );

      const settings = clone(gameTypeSettings.default || {});
      Object.assign(settings, clone(settingsJSON));
      const gameData = {
        settings,
        addTime: Date.now(),
        ...{ deckType, gameType, gameConfig, gameTimer },
      };
      if (gameTimer) gameData.settings.timer = gameTimer;

      this.fillData(gameData, { newGame: true });
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
            this.fillData(dbData);
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
          workerId: application.worker.id,
          port: application.server.port,
        },
        { json: true }
      );
    }

    logs(data, { consoleMsg } = {}) {
      if (!data) return this.#logs;

      if (typeof data === 'string') data = { msg: data };
      if (!data.time) data.time = Date.now();

      if (data.msg.includes('{{player}}')) {
        const player = data.userId
          ? this.getObjects({ className: 'Player' }).find(({ userId }) => userId === data.userId)
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

    getPlayerList() {
      const store = this.getStore();
      return Object.keys(this.playerMap).map((_id) => store.player[_id]);
    }
    getPlayerByUserId(id) {
      return this.getPlayerList().find((player) => player.userId === id);
    }
    async playerJoin({ userId, userName, avatarCode }) {
      try {
        if (this.status === 'FINISHED') throw new Error('Игра уже завершена.');

        const player = this.getFreePlayerSlot();
        if (!player) throw new Error('Свободных мест не осталось');

        player.set({ ready: true, userId, userName, avatarCode });
        this.logs({ msg: `Игрок {{player}} присоединился к игре.`, userId });

        this.checkStatus({ cause: 'PLAYER_JOIN' });
        await this.saveChanges();

        lib.store.broadcaster.publishAction(`user-${userId}`, 'joinGame', {
          gameId: this.id(),
          playerId: player.id(),
          gameType: this.deckType,
          isSinglePlayer: this.isSinglePlayer(),
        });
      } catch (exception) {
        lib.store.broadcaster.publishAction(`user-${userId}`, 'broadcastToSessions', {
          data: { message: exception.message, stack: exception.stack },
        });
      }
    }
    async viewerJoin({ userId, userName, userAvatarCode }) {
      try {
        if (this.status === 'FINISHED') throw new Error('Игра уже завершена.');

        const viewer = new lib.game.objects.Viewer({ userId }, { parent: this });
        viewer.set({ userId, userName, avatarCode: userAvatarCode });
        this.logs({ msg: `Наблюдатель присоединился к игре.` });

        await this.saveChanges();

        lib.store.broadcaster.publishAction(`user-${userId}`, 'joinGame', {
          gameId: this.id(),
          viewerId: viewer.id(),
          gameType: this.deckType,
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
          this.endGame({ canceledByUser: userId });
        } catch (exception) {
          if (exception instanceof lib.game.endGameException) {
            await this.removeGame();
          } else throw exception;
        }
      }
      lib.store.broadcaster.publishAction(`user-${userId}`, 'leaveGame', {});
    }
    endGame({ winningPlayer, canceledByUser } = {}) {
      lib.timers.timerDelete(this);
      this.emitCardEvents('endRound'); // костыли должны восстановить свои значения

      if (this.status !== 'IN_PROCESS') canceledByUser = true; // можно отменить игру, еще она еще не начата (ставим true, чтобы ниже попасть в условие cancel-ветку)
      this.set({ status: 'FINISHED' });
      if (winningPlayer) this.setWinner({ player: winningPlayer });

      const playerList = this.getObjects({ className: 'Player' });
      const playerEndGameStatus = {};
      for (const player of playerList) {
        const { userId } = player;
        const endGameStatus = canceledByUser
          ? userId === canceledByUser
            ? 'lose'
            : 'cancel'
          : this.winUserId
          ? userId === this.winUserId
            ? 'win'
            : 'lose'
          : 'lose'; // игра закончилась автоматически
        player.set({ endGameStatus });
        playerEndGameStatus[userId] = endGameStatus;
      }

      this.checkCrutches();
      this.broadcastAction('gameFinished', {
        gameId: this.id(),
        gameType: this.deckType,
        playerEndGameStatus,
        fullPrice: this.getFullPrice(),
        roundCount: this.round,
        crutchCount: this.crutchCount(),
      });

      throw new lib.game.endGameException();
    }
    setWinner({ player }) {
      this.set({ winUserId: player.userId });
      this.logs({ msg: `Игрок {{player}} победил в игре.`, userId: player.userId });
    }
    getFreePlayerSlot() {
      return this.getPlayerList().find((player) => !player.ready);
    }
    getActivePlayer() {
      return this.getPlayerList().find((player) => player.active);
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

      const playerList = this.getPlayerList();
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
        const player = this.getPlayerList().find((player) => player.userId === userId);
        if (!player) throw new Error('player not found');

        const activePlayer = this.getActivePlayer();
        if (player._id !== activePlayer._id && eventName !== 'leaveGame')
          throw new Error('Игрок не может совершить это действие, так как сейчас не его ход.');
        else if (activePlayer.eventData.actionsDisabled && eventName !== 'endRound' && eventName !== 'leaveGame')
          throw new Error('Игрок не может совершать действия в этот ход.');

        // !!! защитить методы, которые не должны вызываться с фронта
        const result = this.run(eventName, eventData);
        const { clientCustomUpdates } = result || {};

        await this.saveChanges();

        if (clientCustomUpdates) {
          lib.store.broadcaster.publishAction(`user-${userId}`, 'broadcastToSessions', {
            type: 'db/smartUpdated',
            data: clientCustomUpdates,
          });
        }
      } catch (exception) {
        if (exception instanceof lib.game.endGameException) {
          await this.removeGame();
        } else {
          lib.store.broadcaster.publishAction(`user-${userId}`, 'broadcastToSessions', {
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
            const obj = this.getObjectById(id);
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
        const player = this.getActivePlayer();
        if (!player.timerEndTime) {
          if (this.status === 'FINISHED') {
            // тут некорректное завершение таймера игры
            // остановка таймера должна была отработать в endGame
            // бросать endGameException нельзя, потому что в removeGame будет вызов saveChanges, который попытается сделать broadcastData, но channel к этому моменту будет уже удален
            lib.timers.timerDelete(this);
            return;
          } else throw 'player.timerEndTime === NaN';
        }
        // console.log('setInterval', player.timerEndTime - Date.now()); // временно оставил для отладки (все еще появляются setInterval NaN - отловить не смог)
        if (player.timerEndTime < Date.now()) {
          this.checkStatus({ cause: 'PLAYER_TIMER_END' });
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
