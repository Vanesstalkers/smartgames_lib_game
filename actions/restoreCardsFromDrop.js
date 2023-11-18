(function () {
  const deck = this.getObjectByCode('Deck[card]');
  const playedCards = this.decks.drop.getObjects({ className: 'Card' });
  for (const card of playedCards) {
    if (card.restoreAvailable()) card.moveToTarget(deck);
  }
});
