(function () {
  return this.initEvent(lib.game.events.common.gameProcess(), {
    allowedPlayers: this.players(),
  });
});
