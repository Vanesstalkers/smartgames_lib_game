(function () {
  const deck = this.find('Deck[card]');
  const playedCards = this.decks.drop.select('Card');
  for (const card of playedCards) {
    if (card.restoreAvailable()) card.moveToTarget(deck);
  }
});
