() =>
  class GameUser extends lib.lobby.User() {
    /**
     * Сюда попадут рассылки publishData(user...`)
     */
    async processData(data) {
      const wrappedData = data.user?.[this.id()];
      if (wrappedData) data = wrappedData;
      if (data._id) delete data._id;
      this.set(data);
      await this.broadcastData(data);
    }

    async joinGame({
      deckType,
      gameType,
      gameId,
      playerId,
      viewerId,
      checkTutorials = true,
      gameStartTutorialName = 'game-tutorial-start',
    }) {
      const { finishedTutorials = {} } = this;
      let { currentTutorial = {}, helper = null, helperLinks = {} } = this;

      if (checkTutorials) {
        currentTutorial = null;
        helper = null;

        this.set({ currentTutorial, helper });

        if (
          !viewerId && // наблюдателям не нужно обучение
          !helper && // нет активного обучения
          !finishedTutorials[gameStartTutorialName] // обучение не было пройдено ранее
        ) {
          await lib.helper.updateTutorial(this, { tutorial: gameStartTutorialName });
        } else {
          await this.saveChanges();
        }
        helperLinks = {
          ...domain.game.tutorial.getHelperLinks(),
          ...helperLinks,
        };

        this.set({ helperLinks });
        await this.saveChanges();
      }

      this.set({
        ...(!this.rankings?.[deckType] ? { rankings: { [deckType]: {} } } : {}),
      });

      this.set({ gameId, playerId, viewerId });
      await this.saveChanges();

      for (const session of this.sessions()) {
        session.set({ gameId, playerId, viewerId });
        await session.saveChanges();
        session.emit('joinGame', { deckType, gameType, gameId, playerId, viewerId });
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

    async gameFinished({
      gameType,
      playerEndGameStatus,
      fullPrice,
      roundCount,
      preventCalcStats = false,
    } = {}) {
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

      const { steps } = getTutorial('game-tutorial-finished');
      const tutorial = clone(steps, { convertFuncToString: true });
      let incomeText = `${income.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} ₽`;
      if (penaltySum > 0)
        incomeText += ` (с учетом штрафа ${penaltySum.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}₽)`;
      tutorial[endGameStatus].text = tutorial[endGameStatus].text.replace('[[win-money]]', incomeText);
      this.set({ money: (this.money || 0) + income, helper: tutorial[endGameStatus], rankings });
      await this.saveChanges();
    }
  };
