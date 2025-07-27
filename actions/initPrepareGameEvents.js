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

        this.waitForPlayersReady = game.players().map((player) => {
          player.set({
            staticHelper: { text: `Для начала игры нажми кнопку "Готов" и\r\nожидай остальных игроков` },
            eventData: { playDisabled: null, controlBtn: { label: 'Готов', triggerEvent: true } },
          });

          return player.id();
        });

        game.set({ statusLabel: 'Ожидание готовности игроков', status: 'PREPARE_START' });
        lib.timers.timerRestart(game, { time: 30 });

        for (const player of game.players({ ai: true })) this.utils.setPlayerReady.call(this, player);
      },
      handlers: {
        TRIGGER({ initPlayer }) {
          const { game } = this.eventContext();

          this.utils.setPlayerReady.call(this, initPlayer);
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
      utils: {
        setPlayerReady(player) {
          player.set(
            { timerEndTime: null, staticHelper: null, eventData: { controlBtn: null } },
            { reset: ['eventData.controlBtn'] }
          );

          this.waitForPlayersReady = this.waitForPlayersReady.filter((playerId) => playerId !== player.id());
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
