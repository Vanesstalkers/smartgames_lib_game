(function ({ timerOverdue } = {}) {
  let timerOverdueCounter = this.timerOverdueCounter || 0;
  if (timerOverdue) {
    timerOverdueCounter++;
    // если много ходов было завершено по таймауту, то скорее всего все игроки вышли и ее нужно завершать
    if (timerOverdueCounter > this.settings.autoFinishAfterRoundsOverdue) {
      console.error('endGame <- timerOverdue');
      this.run('endGame');
    }
  } else {
    timerOverdueCounter = 0;
  }
  this.set({ timerOverdueCounter });

  const activePlayer = this.roundActivePlayer();
  if (activePlayer) this.toggleEventHandlers('END_ROUND', {}, activePlayer);

  this.dumpState();
  this.run('startNewRound');
});
