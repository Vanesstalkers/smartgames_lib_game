(function () {
  this.initEvent(
    {
      name: 'initPlayerWaitEvents',
      init: function () {
        const { game, player } = this.eventContext();
        game.set({ statusLabel: 'Ожидание игроков', status: 'WAIT_FOR_PLAYERS' });
      },
      handlers: {
        PLAYER_JOIN: function () {
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
      },
    },
    { allowedPlayers: this.players() }
  );
});
