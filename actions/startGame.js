(function () {
  const { restorationMode } = this;
  // PIPELINE_GAME_START (6.4) :: стартуем первый (или восстановленный) раунд игры
  this.run('initGameProcessEvents');
  this.set({ status: 'IN_PROCESS' });

  if (restorationMode) {
    // в игре установлены и active у player-а и roundActivePlayerId у игры, которые обновятся в начале нового раунда
    this.run('startNewRound');
  } else {
    for (const player of this.getActivePlayers()) player.deactivate();
    this.run('startNewRound');
  }
});
