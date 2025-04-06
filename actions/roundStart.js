(function () {
  const roundStepsFunc =
    domain.game.actions.games?.[this.gameType]?.roundSteps ||
    domain.game[this.gameType]?.actions?.roundSteps ||
    domain.game.actions.roundSteps ||
    lib.game.actions.roundSteps;
  if (!roundStepsFunc) throw `Round steps for "${this.gameType}" game not found.`;

  this.roundActivePlayer()?.deactivate();
  const { newRoundLogEvents, statusLabel, newRoundNumber } = roundStepsFunc.call(this);

  // обновляем логи
  for (const logEvent of newRoundLogEvents) this.logs(logEvent);
  this.set({ statusLabel: statusLabel || `Раунд ${newRoundNumber}`, round: newRoundNumber });

  this.dumpState(); // вся структура roundEnd/roundStart/roundSteps сделана ради этой строчки

  lib.timers.timerRestart(this, this.lastRoundTimerConfig);
  // делаем после обновления таймера, в частности из-за карты "time"
  this.playRoundStartCards();
});
