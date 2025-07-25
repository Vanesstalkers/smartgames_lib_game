() => ({
  name: 'gameProcess',
  handlers: {
    PLAYER_TIMER_END({ initPlayer }) {
      const { game } = this.eventContext();
      game.logs({
        msg: `Игрок {{player}} не успел завершить все действия за отведенное время, и раунд завершится автоматически.`,
        userId: initPlayer.userId,
      });
      game.run('roundEnd', { timerOverdue: true }, initPlayer);
      return { preventListenerRemove: true };
    },
  },
});
