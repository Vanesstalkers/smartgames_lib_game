(function () {
  this.initEvent(
    {
      init: function () {
        const { game, player } = this.eventContext();
        game.set({ status: 'IN_PROCESS' });
        game.run('handleRound');
      },
      handlers: {
        PLAYER_TIMER_END: function () {
          const { game, player } = this.eventContext();

          game.logs({ msg: `Раунд завершился автоматически.` });

          const timerOverdueCounter = (game.timerOverdueCounter || 0) + 1;
          // если много ходов было завершено по таймауту, то скорее всего все игроки вышли и ее нужно завершать
          if (timerOverdueCounter > game.settings.autoFinishAfterRoundsOverdue) {
            game.run('endGame');
          }
          game.set({ timerOverdueCounter });

          game.run('handleRound');
          return { preventListenerRemove: true };
        },
      },
    },
    { defaultResetHandler: true, allowedPlayers: this.players() }
  );
});
