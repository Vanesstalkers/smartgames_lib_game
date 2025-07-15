(function () {
  const roundStepsFunc =
    domain.game.actions[this.gameType]?.roundSteps ||
    domain.game[this.gameType]?.actions?.roundSteps ||
    domain.game.actions.roundSteps ||
    lib.game.actions.roundSteps;
  if (!roundStepsFunc) throw `Round steps for "${this.gameType}" game not found.`;

  const {
    newRoundLogEvents,
    statusLabel,
    newRoundNumber,
    roundStep,
    timerRestart = true,
    endRound = false,
  } = roundStepsFunc.call(this);

  // обновляем логи
  for (const logEvent of newRoundLogEvents) this.logs(logEvent);
  this.set({
    statusLabel: statusLabel || `Раунд ${newRoundNumber}`,
    round: newRoundNumber,
    roundStep,
    roundStepsMap: { [roundStep]: true },
  });

  this.dumpState(); // вся структура roundEnd/roundStart/roundSteps сделана ради этой строчки

  if (timerRestart) {
    const timerConfig = timerRestart === true ? this.lastRoundTimerConfig : timerRestart;
    lib.timers.timerRestart(this, timerConfig);
  }

  if (endRound) this.run('roundEnd');
});
