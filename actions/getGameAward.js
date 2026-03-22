(function () {
  const winner = this.players().find((player) => player.endGameStatus === 'win');
  return winner?.money || 0;
});
