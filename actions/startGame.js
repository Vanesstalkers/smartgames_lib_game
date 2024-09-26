(function () {
  this.initEvent(
    {
      init: function () {
        const { game, player } = this.eventContext();
        game.set({ status: 'IN_PROCESS' });
        game.run('handleRound', { notUserCall: true });
      },
      handlers: {
        PLAYER_TIMER_END: function () {
          const { game, player } = this.eventContext();
          game.logs({
            msg: `Игрок {{player}} не успел завершить все действия за отведенное время, и раунд завершится автоматически.`,
            userId: player.userId,
          });
          game.run('handleRound', { timerOverdue: true });
          return { preventListenerRemove: true };
        },
      },
    },
    { defaultResetHandler: true, allowedPlayers: this.players() }
  );
});
