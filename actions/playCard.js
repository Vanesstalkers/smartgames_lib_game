(function ({ cardId }, player) {
  if (player.triggerEventEnabled())
    throw new Error('Игрок не может совершить это действие, пока не завершит активное событие');

  const card = this.get(cardId);

  try {
    card.play({ player, logMsg: `Игрок {{player}} разыграл карту <a>${card.getTitle()}</a>.` });
    card.moveToTarget(this.decks.active);
  } catch (error) {
    this.logs(error.message);
    player.notifyUser(error.message);
  }
});
