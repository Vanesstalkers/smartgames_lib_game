() =>
  new lib.game.GameEvent({
    init: function () {
      const { game, player, source: card } = this.eventContext();
      this.set({
        cardClass: 'highlight-off',
        buttonText: 'Вернуть', // текст кнопки на карте
      });
    },
    handlers: {
      RESET: function () {
        const { game, player, source: card, sourceId } = this.eventContext();

        card.set({ visible: null, played: null, activeEvent: null });

        game.removeAllEventListeners({ sourceId });
      },
      TRIGGER: function ({ target }) {
        const { game, player, source: card } = this.eventContext();
        // у game много TRIGGER-событий, проверка нужна, чтобы не инициировать лишние
        if (target !== card) return { preventListenerRemove: true };

        if (card.group === 'car') card.moveToTarget(player.decks.car);
        if (card.group === 'service') card.moveToTarget(player.decks.service);

        this.emit('RESET');
      },
      ROUND_END: function () {
        this.emit('RESET');
      },
    },
  });
