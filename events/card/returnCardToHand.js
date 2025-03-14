() => ({
  init: function () {
    const { game, player, source: card } = this.eventContext();
    card.set({
      eventData: {
        cardClass: 'highlight-off',
        buttonText: 'Вернуть', // текст кнопки на карте
      },
    });
  },
  handlers: {
    RESET: function () {
      const { source: card } = this.eventContext();

      card.set({
        ...{ visible: null, played: null },
        eventData: { playDisabled: null, cardClass: null, buttonText: null },
      });

      this.destroy();
    },
    TRIGGER: function ({ target }) {
      const { game, player, source: card } = this.eventContext();

      const group = card.group;
      const deck = player.decks[group];
      if (group && deck) card.moveToTarget(deck);

      this.emit('RESET');
    },
    END_ROUND: function () {
      this.emit('RESET');
    },
  },
});
