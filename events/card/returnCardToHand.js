() =>
  new lib.game.GameEvent({
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
        const { game, player, source: card, sourceId } = this.eventContext();

        card.set({
          visible: null,
          played: null,
          eventData: { playDisabled: null, cardClass: null, buttonText: null },
        });
        card.removeEvent(this);

        game.removeAllEventListeners({ sourceId });
      },
      TRIGGER: function ({ target }) {
        const { game, player, source: card } = this.eventContext();

        if (card.group === 'car') card.moveToTarget(player.decks.car);
        if (card.group === 'service') card.moveToTarget(player.decks.service);

        this.emit('RESET');
      },
      ROUND_END: function () {
        this.emit('RESET');
      },
    },
  });
