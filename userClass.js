() =>
  class GameUser extends lib.user.class() {
    initChannel({ col, id } = {}) {
      this.channelName(`gameuser-${this.id()}`);
      super.initChannel({ col, id });
    }

    /**
     * Сюда попадут рассылки publishData(user...`)
     */
    async processData(data) {
      const wrappedData = data.user?.[this.id()];
      if (wrappedData) data = wrappedData;
      this.set(data);
      await this.broadcastData(data);
    }
    /**
     * Переопределяем метод, сохранявший данные в БД - оставляем только рассылки и публикацию в lobby.user 
     */
    async saveChanges({ saveToLobbyUser = false } = {}) {
      const changes = this.getChanges();

      if (saveToLobbyUser) {
        await lib.store.broadcaster.publishData(`user-${this.id()}`, changes);
        // т.к. gameuser подписан на lobby.user, то триггернется this.processData (избегаем повторного вызова this.broadcastData)
      } else {
        this.broadcastData(changes);
      }

      this.clearChanges();
    }

    async joinGame({ deckType, gameType, gameId, playerId, viewerId, isSinglePlayer, checkTutorials = true }) {
      const {
        helper: { getTutorial },
        utils: { structuredClone: clone },
      } = lib;

      for (const session of this.sessions()) {
        session.set({ gameId, playerId, viewerId });
        await session.saveChanges();
        session.emit('joinGame', { deckType, gameType, gameId, playerId, viewerId });
      }

      let { currentTutorial = {}, helper = null, helperLinks = {}, finishedTutorials = {} } = this;

      if (checkTutorials) {
        currentTutorial = null;
        helper = null;

        this.set({ currentTutorial, helper });

        const gameStartTutorialName = 'game-tutorial-start';
        if (
          !viewerId && // наблюдателям не нужно обучение
          !helper && // нет активного обучения
          !finishedTutorials[gameStartTutorialName] // обучение не было пройдено ранее
        ) {
          const tutorial = getTutorial(gameStartTutorialName);
          helper = Object.values(tutorial).find(({ initialStep }) => initialStep);
          helper = clone(helper, { convertFuncToString: true });
          currentTutorial = { active: gameStartTutorialName };
        } else {
          await this.saveChanges({ saveToLobbyUser: true });
        }
        helperLinks = {
          ...domain.game.tutorial.getHelperLinks(),
          ...helperLinks,
        };

        this.set({ currentTutorial, helper, helperLinks });
        await this.saveChanges();
      }

      this.set({
        ...(!this.rankings?.[deckType] ? { rankings: { [deckType]: {} } } : {}),
      });

      this.set({ gameId, playerId, viewerId });
      await this.saveChanges({ saveToLobbyUser: true });
    }
    async leaveGame() {
      const { gameId } = this;

      this.set({ gameId: null, playerId: null, viewerId: null });
      if (this.currentTutorial?.active) {
        this.set({ currentTutorial: null, helper: null });
      }
      await this.saveChanges({ saveToLobbyUser: true });

      this.unsubscribe(`game-${gameId}`);
      for (const session of this.sessions()) {
        session.unsubscribe(`game-${gameId}`);
        session.set({ gameId: null, playerId: null, viewerId: null });
        await session.saveChanges();
        session.emit('leaveGame');
      }
    }

    async gameFinished({ gameId, gameType, playerEndGameStatus, fullPrice, roundCount, preventCalcStats = false } = {}) {
      const {
        helper: { getTutorial },
        utils: { structuredClone: clone },
      } = lib;

      if (this.viewerId) {
        this.set({
          helper: {
            text: 'Игра закончена',
            buttons: [{ text: 'Выйти из игры', action: 'leaveGame' }],
            actions: {
              leaveGame: (async () => {
                await api.action.call({ path: 'game.api.leave', args: [] }).catch(prettyAlert);
                return { exit: true };
              }).toString(),
            },
          },
        });
        await this.saveChanges();
        return;
      }

      if (preventCalcStats) return;

      const endGameStatus = playerEndGameStatus[this.id()];

      const rankings = clone(this.rankings || {});
      if (!rankings[gameType]) rankings[gameType] = {};
      const { games = 0, win = 0, money = 0, penalty = 0, totalTime = 0 } = rankings[gameType];

      let income = 0;
      let penaltySum = 0;
      if (endGameStatus === 'win') {
        penaltySum = 0;
        income = fullPrice * 1000 - penaltySum;
        rankings[gameType].money = money + income;
        if (income < 0) income = 0; // в рейтинги отрицательный результата пишем
        rankings[gameType].penalty = penalty + penaltySum;
        rankings[gameType].win = win + 1;
      }
      rankings[gameType].games = games + 1;
      rankings[gameType].totalTime = totalTime + roundCount;
      rankings[gameType].avrTime = Math.floor(rankings[gameType].totalTime / rankings[gameType].win);

      const tutorial = clone(getTutorial('game-tutorial-finished'), {
        convertFuncToString: true,
      });
      let incomeText = `${income.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} ₽`;
      if (penaltySum > 0)
        incomeText += ` (с учетом штрафа ${penaltySum.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}₽)`;
      tutorial[endGameStatus].text = tutorial[endGameStatus].text.replace('[[win-money]]', incomeText);
      this.set({ money: (this.money || 0) + income, helper: tutorial[endGameStatus], rankings });
      await this.saveChanges({ saveToLobbyUser: true });
    }
  };
