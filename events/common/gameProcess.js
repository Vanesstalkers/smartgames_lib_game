() => ({
  name: 'gameProcess',
  handlers: {
    PLAYER_TIMER_END() {
      const { game, player } = this.eventContext();
      game.logs({
        msg: `Игрок {{player}} не успел завершить все действия за отведенное время, и раунд завершится автоматически.`,
        userId: player.userId,
      });
      game.run('roundEnd', { timerOverdue: true });
      return { preventListenerRemove: true };
    },
  },
});
