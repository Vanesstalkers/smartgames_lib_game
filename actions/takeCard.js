(function ({ count }) {
  return;
  const player = this.getActivePlayer();
  const playerHand = player.getObjectByCode('Deck[card]');
  const deck = this.getObjectByCode('Deck[card]');
  deck.moveRandomItems({ count, target: playerHand });
});
