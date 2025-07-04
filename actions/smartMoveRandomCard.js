(function ({ deck, target }) {
  if (!deck) deck = this.find('Deck[card]');
  let card = deck.getRandomItem();
  if (card) card.moveToTarget(target);
  else {
    this.run('restoreCardsFromDrop', { deck });
    card = deck.getRandomItem();
    if (card) card.moveToTarget(target);
  }
  return card;
});
