(function () {
  const event = this.initEvent(
    {
      name: 'initPrepareGameEvents',
      init() {
        const { game } = this.eventContext();

        if (game.isSinglePlayer()) {
          game.run('startGame');
          return { resetEvent: true };
        }

        game.set({ statusLabel: 'Ожидание готовности игроков', status: 'PREPARE_START' });
        this.waitForPlayersReady = game.players().map((player) => {
          lib.timers.timerRestart(game, { time: 30 });

          player.set({
            staticHelper: { text: `Для начала игры нажми кнопку "Готов" и\r\nожидай остальных игроков` },
            eventData: { playDisabled: null, controlBtn: { label: 'Готов', triggerEvent: true } },
          });

          return player.id();
        });
      },
      handlers: {
        TRIGGER({ initPlayer }) {
          const { game } = this.eventContext();

          initPlayer.set(
            { timerEndTime: null, staticHelper: null, eventData: { controlBtn: null } },
            { reset: ['eventData.controlBtn'] }
          );

          this.waitForPlayersReady = this.waitForPlayersReady.filter((playerId) => playerId !== initPlayer.id());
          if (this.waitForPlayersReady.length > 0) return { preventListenerRemove: true };

          lib.timers.timerDelete(game);
          this.emit('RESET');

          game.run('startGame');
        },
        PLAYER_TIMER_END({ player }) {
          const { game } = this.eventContext();
          for (const player of game.players()) {
            if (!this.waitForPlayersReady.includes(player.id())) continue;
            this.emit('TRIGGER', {}, player);
          }
        },
        RESET() {
          const { game } = this.eventContext();

          for (const player of game.players()) {
            player.removeEventWithTriggerListener();
            player.deactivate();
          }

          this.destroy();
        },
      },
    },
    { allowedPlayers: this.players() }
  );

  if (!event) return;

  for (const player of this.players()) {
    player.setEventWithTriggerListener(event);
  }
});
