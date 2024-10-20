(function ({ notUserCall, timerOverdue } = {}) {
  let timerOverdueCounter = this.timerOverdueCounter || 0;
  if (timerOverdue) {
    timerOverdueCounter++;
    // если много ходов было завершено по таймауту, то скорее всего все игроки вышли и ее нужно завершать
    if (timerOverdueCounter > this.settings.autoFinishAfterRoundsOverdue) {
      console.error("endGame <- timerOverdue");
      this.run('endGame');
    }
  } else {
    timerOverdueCounter = 0;
  }
  this.set({ timerOverdueCounter });

  const players = this.players();
  const initPlayer = !notUserCall ? this.getActivePlayer() : undefined;

  if (initPlayer) {
    this.toggleEventHandlers('END_ROUND', {}, initPlayer);
    initPlayer.deactivate();
  }

  if (!this.checkAllPlayersFinishRound()) return; // ждем завершения хода всеми игроками

  this.toggleEventHandlers(this.roundStep, {}, players);

  const roundStepsFunc =
    domain.game.actions.games?.[this.gameType].roundSteps ||
    domain.game.actions.roundSteps ||
    lib.game.actions.roundSteps;
  if (!roundStepsFunc) throw `Round steps for "${this.gameType}" game not found.`;

  const { newRoundLogEvents, statusLabel, newRoundNumber } = roundStepsFunc.call(this, { initPlayer });

  // обновляем логи
  for (const logEvent of newRoundLogEvents) this.logs(logEvent);
  this.set({ statusLabel: statusLabel || `Раунд ${newRoundNumber}`, round: newRoundNumber });
  this.dumpState();
});
