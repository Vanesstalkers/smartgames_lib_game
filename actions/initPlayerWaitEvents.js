(function () {
  this.initEvent(
    {
      name: 'initPlayerWaitEvents',
      init() {
        const { game, player } = this.eventContext();
        this.realStatusLabel = game.statusLabel;
        game.set({ statusLabel: 'Ожидание игроков', status: 'WAIT_FOR_PLAYERS' });
      },
      handlers: {
        PLAYER_JOIN() {
          const { game } = this.eventContext();

          if (game.getFreePlayerSlot()) return { preventListenerRemove: true };

          this.emit('RESET');

          if (game.restorationMode) return game.restart();

          try {
            game.run('initPrepareGameEvents');
          } catch (err) {
            // может не быть обработчика
            game.run('startGame');
          }
        },
        RESET() {
          const { game } = this.eventContext();
          game.set({ statusLabel: this.realStatusLabel });
          this.destroy();
        },
      },
    },
    { allowedPlayers: this.players() }
  );
});
