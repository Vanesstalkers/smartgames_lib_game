(function () {
  const roundStepsFunc =
    domain.game.actions[this.gameType]?.roundSteps ||
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

  const player = this.roundActivePlayer();

  let message = "Новый раунд";
  if (!this.isSinglePlayer()) message += ". Ваш ход.";
  player.notifyUser({ message }, { hideTime: 3000 });

  lib.timers.timerRestart(this, this.lastRoundTimerConfig);
});
