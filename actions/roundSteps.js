(function () {
  const {
    round,
    settings: {
      // конфиги
    },
  } = this;
  const newActivePlayer = this.selectNextActivePlayer();

  const newRoundNumber = round + 1;
  const newRoundLogEvents = [];
  newRoundLogEvents.push(`Начало раунда №${newRoundNumber}.`);

  // обновляем таймер
  const actionsDisabled = newActivePlayer.eventData.actionsDisabled === true;
  const timerConfig = actionsDisabled ? { time: 5 } : {};
  lib.timers.timerRestart(this, timerConfig);

  newActivePlayer.activate(); // делаем строго после проверки actionsDisabled (внутри activate значение сбросится)
  return { newRoundLogEvents, newRoundNumber };
});
