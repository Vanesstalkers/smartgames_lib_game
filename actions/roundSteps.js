(function ({ initPlayer: lastRoundActivePlayer }) {
  const {
    round,
    settings: {
      // конфиги
    },
  } = this;

  const selectNewActivePlayer = () => {
    if (lastRoundActivePlayer?.eventData.extraTurn) {
      lastRoundActivePlayer.set({ eventData: { extraTurn: null } });
      if (lastRoundActivePlayer.eventData.skipTurn) {
        // актуально только для событий в течение хода игрока, инициированных не им самим
        lastRoundActivePlayer.set({ eventData: { skipTurn: null } });
      } else {
        this.logs({
          msg: `Игрок {{player}} получает дополнительный ход.`,
          userId: lastRoundActivePlayer.userId,
        });
        return lastRoundActivePlayer;
      }
    }

    const playerList = this.players();
    const activePlayerIndex = playerList.findIndex((player) => player === lastRoundActivePlayer);
    const newActivePlayer = playerList[(activePlayerIndex + 1) % playerList.length];
    newActivePlayer.activate();

    if (newActivePlayer.eventData.skipTurn) {
      this.logs({
        msg: `Игрок {{player}} пропускает ход.`,
        userId: newActivePlayer.userId,
      });
      newActivePlayer.set({
        eventData: {
          skipTurn: null,
          actionsDisabled: true,
        },
      });
    }
    return newActivePlayer;
  };

  if (round > 0 && lastRoundActivePlayer) {
    this.logs(
      { msg: `Игрок {{player}} закончил раунд №${round}.`, userId: lastRoundActivePlayer.userId }, //
      { consoleMsg: true }
    );
  }

  const newRoundActivePlayer = selectNewActivePlayer();

  const newRoundNumber = round + 1;
  const newRoundLogEvents = [];
  newRoundLogEvents.push(`Начало раунда №${newRoundNumber}.`);

  // обновляем таймер
  const actionsDisabled = newRoundActivePlayer.eventData.actionsDisabled === true;
  const timerConfig = actionsDisabled ? { time: 5 } : {};
  lib.timers.timerRestart(this, timerConfig);

  return { newRoundLogEvents, newRoundNumber };
});
