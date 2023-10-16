() =>
  new lib.game.GameEvent({
    init: function () {
      const { game, player, source: card } = this.eventContext();
      this.set({
        canPlay: true,
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
        if (target !== card) return { preventListenerRemove: true }; // у game много TRIGGER-событий, проверка нужна, чтобы не инициировать лишние

        if (card.group === 'car') {
          const targetDeck = player.getObjectByCode('Deck[card_car]');
          card.moveToTarget(targetDeck);
        }
        if (card.group === 'service') {
          const targetDeck = player.getObjectByCode(`Deck[card_service]`);
          card.moveToTarget(targetDeck);
        }

        this.emit('RESET');
      },
      ROUND_END: function () {
        this.emit('RESET');
      },
    },
  });
