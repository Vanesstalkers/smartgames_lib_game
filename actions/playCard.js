(function ({ cardId, targetPlayerId }, player) {
  const card = this.get(cardId);

  if (card.eventData.playDisabled || card.parent().eventData.playDisabled || player.eventData.playDisabled)
    throw new Error('Эту карту нельзя разыгрывать.');

  if (card.eventData.canReturn) return card.returnToHand({ player });
  if (card.eventData.activeEvents.length) {
    for (const event of card.eventData.activeEvents) {
      event.emit('TRIGGER', { targetId: cardId, targetPlayerId });
    }
    return;
  }

  card.moveToTarget(player.decks.played);

  card.set({
    eventData: {
      ...{ playedTime: Date.now(), canReturn: true },
      ...{ cardClass: 'highlight-off', buttonText: 'Вернуть' },
      restoreState: {
        buttonText: card.eventData.buttonText || null,
        cardClass: card.eventData.cardClass || null,
      },
    },
  });
});
