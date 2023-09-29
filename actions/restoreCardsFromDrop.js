(function () {
  const deck = this.getObjectByCode('Deck[card]');
  const deckDrop = this.getObjectByCode('Deck[card_drop]');
  for (const card of deckDrop.getObjects({ className: 'Card' })) {
    if (card.restoreAvailable()) card.moveToTarget(deck);
  }
});
