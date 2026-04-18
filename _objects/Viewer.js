(class Viewer extends lib.game.GameObject {
  #eventWithTriggerListener = null;

  constructor(data, { parent }) {
    super(data, { col: 'viewer', parent });
    this.broadcastableFields(['_id', 'userId', 'isViewer', 'gameMaster', 'avatarCode', 'avatarUrl', 'eventData', 'staticHelper']);

    const { userId, gameMaster, avatarCode, avatarUrl, eventData, staticHelper } = data;
    this.set({ isViewer: true, userId, gameMaster, avatarCode, avatarUrl, eventData, staticHelper }); 
  }

  notifyUser(data = {}, config = {}) {
    if (typeof data === 'string') data = { message: data };
    lib.store.broadcaster.publishAction.call(this.game(), `user-${this.userId}`, 'broadcastToSessions', {
      data,
      config,
    });
  }

  setEventWithTriggerListener(event) {
    if (this.#eventWithTriggerListener) throw new Error('Предыдущее событие не завершено');
    if (!event.hasHandler('TRIGGER')) throw new Error('Событие не содержит обработчик TRIGGER');

    this.#eventWithTriggerListener = event;
    this.set({ eventData: { triggerListenerEnabled: Date.now() } });
  }
  removeEventWithTriggerListener() {
    this.#eventWithTriggerListener = null;
    this.set({ eventData: { triggerListenerEnabled: null } });
  }
  handleEventWithTriggerListener(handler, data = {}) {
    if (!this.#eventWithTriggerListener) throw new Error('Событие не найдено');
    return this.#eventWithTriggerListener.emit(handler, data, this);
  }
  triggerEventEnabled({ ignoreEvents = [] } = {}) {
    const ignore = ignoreEvents.includes(this.#eventWithTriggerListener?.name);
    const enabled = this.#eventWithTriggerListener !== null && !ignore;
    return enabled ? this.#eventWithTriggerListener : false;
  }
});
