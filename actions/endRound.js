(function ({ timerOverdue, forceActivePlayer } = {}) {
  if (this.status !== 'IN_PROCESS') {
    console.log('game', { status: this.status, id: this.id() });
    throw new Error('Действие запрещено.');
  }

  const {
    round,
    activeEvent, // нельзя тут объявлять, потому что он динамически обновиться в toggleEventHandlers
    settings: {
      // конфиги
      autoFinishAfterRoundsOverdue,
    },
  } = this;

  const timerOverdueCounter = timerOverdue ? (this.timerOverdueCounter || 0) + 1 : 0;
  // если много ходов было завершено по таймауту, то скорее всего все игроки вышли и ее нужно завершать
  if (timerOverdueCounter > autoFinishAfterRoundsOverdue) {
    this.endGame();
  }

  // player чей ход только что закончился (получаем принципиально до вызова changeActivePlayer)
  const prevPlayer = this.getActivePlayer();

  if (round > 0) {
    if (timerOverdue) {
      this.logs({
        msg: `Игрок {{player}} не успел завершить все действия за отведенное время, и раунд №${round} завершился автоматически.`,
        userId: prevPlayer.userId,
      });
    } else {
      this.logs(
        {
          msg: `Игрок {{player}} закончил раунд №${round}.`,
          userId: prevPlayer.userId,
        },
        { consoleMsg: true }
      );
    }
  }

  if (timerOverdue || this.activeEvent) {
    // таймер закончился или нажата кнопка окончания раунда при не завершенном активном событии

    if (this.activeEvent) {
      const source = this.getObjectById(this.activeEvent.sourceId);
      this.logs(`Так как раунд был завершен, активное событие "${source.title}" сработало автоматически.`);
    }
  }

  // ЛОГИКА ОКОНЧАНИЯ ТЕКУЩЕГО РАУНДА

  this.toggleEventHandlers('endRound');
  this.clearEvents();

  // ЛОГИКА НАЧАЛА НОВОГО РАУНДА

  // player которому передают ход
  const activePlayer = this.changeActivePlayer({ player: forceActivePlayer });
  const playerCardHand = activePlayer.getObjectByCode('Deck[card]');

  const playedCards = this.decks.active.getObjects({ className: 'Card' });
  for (const card of playedCards) {
    if (!card.isPlayOneTime()) card.set({ played: null });
    card.moveToTarget(this.decks.drop);
  }

  const newRoundNumber = round + 1;
  const newRoundLogEvents = [];
  newRoundLogEvents.push(`Начало раунда №${newRoundNumber}.`);

  const card = this.run('smartMoveRandomCard', {
    target: playerCardHand,
  });

  // обновляем таймер
  const actionsDisabled = activePlayer.eventData.actionsDisabled === true;
  const timerConfig = actionsDisabled ? { time: 5 } : {};
  lib.timers.timerRestart(this, timerConfig);

  // обновляем логи
  for (const logEvent of newRoundLogEvents) this.logs(logEvent);

  this.set({ round: newRoundNumber, timerOverdueCounter });
});
