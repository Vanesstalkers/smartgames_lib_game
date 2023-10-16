(function ({ cardId }, player) {
  if (this.activeEvent)
    throw new Error(
      this.activeEvent.errorMsg || 'Игрок не может совершить это действие, пока не завершит активное событие.'
    );

  const card = this.getObjectById(cardId);
  card.play({ player });
  const cardDeckDrop = this.getObjectByCode('Deck[card_active]');
  card.moveToTarget(cardDeckDrop);

  this.logs(`Пользователь {{player}} активировал событие "${card.title}".`);
});
