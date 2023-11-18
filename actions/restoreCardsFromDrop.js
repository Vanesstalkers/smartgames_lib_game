(function () {
  const deck = this.getObjectByCode('Deck[card]');
  for (const card of this.decks.drop.getObjects({ className: 'Card' })) {
    if (card.restoreAvailable()) card.moveToTarget(deck);
  }
});
