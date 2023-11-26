(function ({ forceActivePlayer } = {}) {
  const {
    round,
    settings: {
      // конфиги
      playerHandLimit,
    },
  } = this;

  // player чей ход только что закончился (получаем принципиально до вызова changeActivePlayer)
  const prevPlayer = this.getActivePlayer();
  const prevPlayerHand = prevPlayer.find('Deck[domino]');

  if (round > 0) {
    this.logs(
      {
        msg: `Игрок {{player}} закончил раунд №${round}.`,
        userId: prevPlayer.userId,
      },
      { consoleMsg: true }
    );
  }

  this.toggleEventHandlers('END_ROUND');

  // player которому передают ход
  const activePlayer = this.changeActivePlayer({ player: forceActivePlayer });
  const playerCardHand = activePlayer.find('Deck[card]');

  const playedCards = this.decks.active.select('Card');
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

  this.set({
    statusLabel: `Раунд ${newRoundNumber}`,
    round: newRoundNumber,
    timerOverdueCounter,
  });
});
