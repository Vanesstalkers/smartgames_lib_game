() =>
  class GameUser extends lib.lobby.User() {
    lastGames = [];

    /**
     * Сюда попадут рассылки publishData(user...`)
     */
    async processData(data, broadcaster) {
      const wrappedData = data.user?.[this.id()];
      if (wrappedData) data = wrappedData;
      if (data._id) delete data._id;
      this.set(data);
      await this.broadcastData(data);
    }

    async joinGame({ gameId, playerId, teamId, viewerId, restoreAction = false, checkTutorials = true }) {
      const game = lib.store('game').get(gameId);
      const gameCode = game.gameCode;
      const gameType = game.gameType;
      const gameConfig = game.gameConfig;
      const addTime = game.addTime;
      const tutorial = game.startTutorialName;

      if (!gameCode || !gameType || !gameConfig) throw 'bad_game_data';

      if (restoreAction === false) {
        const { finishedTutorials = {} } = this;
        let { currentTutorial = {}, helper = null, helperLinks = {} } = this;

        if (checkTutorials) {
          currentTutorial = null;
          helper = null;

          this.set({ currentTutorial, helper });

          if (
            !viewerId && // наблюдателям не нужно обучение
            !helper && // нет активного обучения
            tutorial &&
            !finishedTutorials[tutorial] // обучение не было пройдено ранее
          ) {
            await lib.helper.updateTutorial(this, { tutorial });
          }

          helperLinks = {
            ...domain.game.tutorial.getHelperLinks(),
            ...helperLinks,
          };

          this.set({ helperLinks });
        }

        this.set({
          ...(!this.rankings?.[gameCode] ? { rankings: { [gameCode]: {} } } : {}),
          lastGames: this.lastGames.concat({ gameId, gameCode, gameType, gameConfig, addTime, playerId }).slice(-20),
        });
      }

      this.set({ gameId, playerId, viewerId, teamId });
      await this.saveChanges();

      for (const session of this.sessions()) {
        session.set({ gameId, playerId, viewerId });
        await session.saveChanges();

        session.emit('joinGame', { gameCode, gameType, gameId });
      }
    }
    async leaveGame() {
      const { gameId } = this;

      this.set({ gameId: null, playerId: null, viewerId: null });
      if (this.currentTutorial?.active) {
        this.set({ currentTutorial: null, helper: null });
      }
      await this.saveChanges();

      this.unsubscribe(`game-${gameId}`);
      for (const session of this.sessions()) {
        session.unsubscribe(`game-${gameId}`);
        session.set({ gameId: null, playerId: null, viewerId: null });
        await session.saveChanges();
        session.emit('leaveGame');
      }
    }

    async gameFinished({ gameCode, userEndGameStatusMap, gameAward, roundCount, preventCalcStats = false } = {}) {
      const {
        utils: { structuredClone: clone },
      } = lib;

      if (this.viewerId) {
        this.set({
          helper: {
            text: 'Игра закончена',
            buttons: [{ text: 'Выйти из игры', action: 'leaveGame' }],
            actions: {
              leaveGame: (async () => {
                await api.action.call({ path: 'game.api.leave', args: [] }).catch(window.prettyAlert);
                return { exit: true };
              }).toString(), // если без toString(), то нужно вызывать через helper.updateTutorial
            },
          },
        });
        await this.saveChanges();
        return;
      }

      if (preventCalcStats) return;

      const endGameStatus = userEndGameStatusMap[this.id()];

      const rankings = clone(this.rankings || {});
      if (!rankings[gameCode]) rankings[gameCode] = {};
      const { games = 0, win = 0, money = 0, penalty = 0, totalTime = 0 } = rankings[gameCode];

      let income = 0;
      let penaltySum = 0;
      if (endGameStatus === 'win') {
        penaltySum = 0;
        income = gameAward * 1000 - penaltySum;
        rankings[gameCode].money = money + income;
        if (income < 0) income = 0; // в рейтинги отрицательный результата пишем
        rankings[gameCode].penalty = penalty + penaltySum;
        rankings[gameCode].win = win + 1;
      }
      rankings[gameCode].games = games + 1;
      rankings[gameCode].totalTime = totalTime + roundCount;
      rankings[gameCode].avrTime = Math.floor(rankings[gameCode].totalTime / rankings[gameCode].win);

      const { steps } = this.getTutorial('game-tutorial-finished');
      const tutorial = clone(steps, { convertFuncToString: true });
      let incomeText = `${income.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} ₽`;
      if (penaltySum > 0)
        incomeText += ` (с учетом штрафа ${penaltySum.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}₽)`;
      tutorial[endGameStatus].text = tutorial[endGameStatus].text.replace('[[win-money]]', incomeText);
      this.set({ money: (this.money || 0) + income, helper: tutorial[endGameStatus], rankings });
      await this.saveChanges();
    }

    async updateTutorial(data) {
      const { tutorial, usedLink } = data;

      if (typeof tutorial === 'object') {
        const { cardId } = tutorial;
        if (cardId != null) {
          const game = lib.store('game').get(this.gameId);
          const card = game.get(cardId);
          if (!card) return;

          const cardTutorialGenerator =
            domain.game.tutorial.cardTutorialGenerator || lib.game.tutorial.cardTutorialGenerator;

          const helper = cardTutorialGenerator.call(game, { card });
          if (helper) {
            this.set({ helper }, { reset: ['helper', 'helper.actions'], removeEmptyObject: true });
            await this.saveChanges();
          }
        }
        return;
      }

      await lib.helper.updateTutorial(this, data);

      if (this.gameId && usedLink && (this.helperLinks[usedLink]?.used || 0) < 2) {
        lib.store.broadcaster.publishAction.call(this, `game-${this.gameId}`, 'playerUseTutorial', {
          userId: this.id(),
          usedLink,
        });
      }
    }

    getTutorial(formattedPath) {
      return lib.helper.getTutorial(formattedPath);
    }
  };
