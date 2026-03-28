(class Dicecube extends lib.game.GameObject {
  #values = [1, 2, 3, 4, 5, 6];

  constructor(data, { parent }) {
    super(data, { col: 'dicecube', parent });
    this.broadcastableFields(['_id', 'value', 'subtype', 'lastRollTime']);

    const { value, subtype, lastRollTime = 0 } = data;
    const initialValue = this.#values.includes(value) ? value : this.#values[0];
    this.set({ value: initialValue, subtype });
  }

  roll() {
    const value = 1 + Math.floor(Math.random() * 6);
    this.set({ value, lastRollTime: Date.now() });
  }
});
