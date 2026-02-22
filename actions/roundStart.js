(function ({ preventDumpState = false } = {}) {
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
    forcedEndRound = false,
  } = roundStepsFunc.call(this);

  // обновляем логи
  for (const logEvent of newRoundLogEvents) this.logs(logEvent);
  this.set({ statusLabel: statusLabel || `Раунд ${newRoundNumber}`, round: newRoundNumber });
  if (roundStep) this.set({ roundStep });

  if (forcedEndRound) return this.run('roundEnd');

  this.set({ roundStepsMap: { [roundStep]: true } }); // !!! переделать на {[newRoundNumber]: { [roundStep]: true }} (+ не забыть фронт)

  if (!preventDumpState) this.dumpState();

  const timerConfig = timerRestart === true ? this.lastRoundTimerConfig : timerRestart;
  lib.timers.timerRestart(this, timerConfig);
});
