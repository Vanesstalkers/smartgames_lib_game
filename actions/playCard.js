(function ({ cardId }, player) {
  if (this.activeEvent)
    throw new Error(
      this.activeEvent.errorMsg || 'Игрок не может совершить это действие, пока не завершит активное событие.'
    );

  const card = this.getObjectById(cardId);
  card.play({ player });
  card.moveToTarget(this.decks.active);

  this.logs(`Пользователь {{player}} активировал событие "${card.title}".`);
});
