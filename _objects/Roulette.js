(class Roulette extends lib.game.GameObject {
  constructor(data, { parent }) {
    super(data, { col: 'roulette', parent });
    this.broadcastableFields(['_id', 'value', 'subtype', 'lastRollTime', 'sectors']);

    const sectors = data.sectors || [
      ...['0', '32', '15', '19', '4', '21', '2', '25', '17', '34', '6', '27', '13'],
      ...['36', '11', '30', '8', '23', '10', '5', '24', '16', '33', '1', '20', '14'],
      ...['28', '12', '35', '3', '26', '31', '9', '22', '18', '29', '7'],
    ];
    const initialValue = data.value || sectors[0];
    const { subtype, lastRollTime = 0 } = data;
    const settings = data.settings || {};
    this.set({ value: initialValue, sectors, subtype, lastRollTime, settings });
  }

  spin() {
    const value = this.sectors[Math.floor(Math.random() * this.sectors.length)];
    this.set({ value, lastRollTime: Date.now() });
  }
});
