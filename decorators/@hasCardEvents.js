({
  decorate: ({ additionalCardEvents }) => ({
    cardEvents: {
      eventTrigger: [],
      endRound: [],
      timerOverdue: [],
      ...additionalCardEvents,
    },
    addCardEvent({ event, source }) {
      if (!this.cardEvents[event]) this.set({ cardEvents: { [event]: [] } });
      this.set({
        cardEvents: {
          [event]: this.cardEvents[event].concat(source.id()),
        },
      });
    },
    deleteCardEvent({ event, source }) {
      if (!this.cardEvents[event]) throw new Error(`cardEvent not found (code=${this.code}, event=${event})`);
      this.set({
        cardEvents: {
          [event]: this.cardEvents[event].filter((id) => id !== source._id),
        },
      });
    },
    /**
     * События карт
     */
    emitCardEvents(event, data) {
      if (!this.cardEvents[event]) throw new Error(`cardEvent not found (code=${this.code}, event=${event})`);
      for (const sourceId of this.cardEvents[event]) {
        const source = this.getObjectById(sourceId);
        const { saveEvent, timerOverdueOff } = source.emit(event, data) || {};
        if (!saveEvent) this.deleteCardEvent({ event, source });
        if (timerOverdueOff) this.deleteCardEvent({ event: 'timerOverdue', source });
      }
    },
    clearCardEvents() {
      for (const event of Object.keys(this.cardEvents)) {
        this.set({ cardEvents: { [event]: [] } });
      }
    },
  }),
});
