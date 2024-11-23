(function () {
  return this.initEvent(lib.game.events.common.gameProcess(), {
    defaultResetHandler: true,
    allowedPlayers: this.players(),
  });
});
