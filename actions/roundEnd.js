(function ({ timerOverdue } = {}) {
  this.updateTimerOverdueCounter(timerOverdue);

  const activePlayer = this.roundActivePlayer();
  if (activePlayer) {
    this.toggleEventHandlers('END_ROUND', {}, activePlayer);
    activePlayer.deactivate();
  }

  this.run('roundStart');
});
