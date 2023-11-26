(function ({ cardId }, player) {
  if (this.triggerEventEnabled() || player.triggerEventEnabled())
    throw new Error('Игрок не может совершить это действие, пока не завершит активное событие.');

  const card = this.get(cardId);
  card.play({
    player,
    logMsg: `Пользователь {{player}} разыграл карту "${card.title}".`,
  });
  card.moveToTarget(this.decks.active);
});
