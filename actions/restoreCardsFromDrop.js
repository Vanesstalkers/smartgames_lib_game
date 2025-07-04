(function ({ deck, deckDrop } = {}) {
  if (!deck) deck = this.find('Deck[card]');
  if (!deckDrop) deckDrop = this.decks.drop;

  if (!deck || !deckDrop) throw new Error('Не найдены колоды для восстановления карт');

  let playedCards = deckDrop.select('Card');
  if (deck.cardGroups) playedCards = playedCards.filter(({ group }) => deck.cardGroups.includes(group));

  for (const card of playedCards) {
    if (card.restoreAvailable()) card.moveToTarget(deck);
  }
});
