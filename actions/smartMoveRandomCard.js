(function ({ target }) {
  const deck = this.getObjectByCode('Deck[card]');
  let card = deck.getRandomItem();
  if (card) card.moveToTarget(target);
  else {
    this.run('restoreCardsFromDrop');
    card = deck.getRandomItem();
    if (card) card.moveToTarget(target);
  }
  return card;
});
