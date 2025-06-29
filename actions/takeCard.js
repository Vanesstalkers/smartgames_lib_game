(function ({ count }) {
  return;
  const player = this.roundActivePlayer();
  const playerHand = player.find('Deck[card]');
  const deck = this.find('Deck[card]');
  deck.moveRandomItems({ count, target: playerHand });
});
