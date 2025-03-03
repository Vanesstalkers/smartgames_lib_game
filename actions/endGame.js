(function ({ winningPlayer, canceledByUser, customFinalize = false, message } = {}) {
  lib.timers.timerDelete(this);

  if (this.status !== 'IN_PROCESS') canceledByUser = true; // можно отменить игру, еще она еще не начата (ставим true, чтобы ниже попасть в условие cancel-ветку)

  this.set({ statusLabel: 'Игра закончена', status: 'FINISHED' });

  // делается после, чтобы можно было в END_ROUND-обработчике сделать проверку на FINISHED-статус
  this.toggleEventHandlers('END_ROUND');

  if (message) this.logs(`Игра закончилась по причине: "${message}"`);

  if (winningPlayer) this.setWinner({ player: winningPlayer });

  const playerEndGameStatus = {};
  for (const player of this.players()) {
    const { userId } = player;
    const endGameStatus = canceledByUser
      ? userId === canceledByUser
        ? 'lose'
        : 'cancel'
      : this.winUserId // у игры есть победитель
      ? userId === this.winUserId
        ? 'win'
        : 'lose'
      : 'lose'; // игра закончилась автоматически
    player.set({ endGameStatus });
    playerEndGameStatus[userId] = endGameStatus;
  }

  this.set({ playerEndGameStatus });

  if (customFinalize) return; // для кастомных endGame-обработчиков

  this.broadcastAction('gameFinished', {
    gameId: this.id(),
    gameType: this.deckType,
    playerEndGameStatus,
    fullPrice: this.getFullPrice(),
    roundCount: this.round,
  });

  throw new lib.game.endGameException();
});
