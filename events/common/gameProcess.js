() => ({
  handlers: {
    PLAYER_TIMER_END: function () {
      const { game, player } = this.eventContext();
      game.logs({
        msg: `Игрок {{player}} не успел завершить все действия за отведенное время, и раунд завершится автоматически.`,
        userId: player.userId,
      });
      game.run('updateRoundStep', { timerOverdue: true });
      return { preventListenerRemove: true };
    },
  },
});
