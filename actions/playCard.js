(function ({ cardId }, player) {
  if (player.triggerEventEnabled())
    throw new Error('Игрок не может совершить это действие, пока не завершит активное событие');

  const card = this.get(cardId);
  card.play({
    player,
    logMsg: `Игрок {{player}} разыграл карту <a>${card.title}</a>.`,
  });
  card.moveToTarget(this.decks.active);
});
