(class Roulette extends lib.game.GameObject {
  constructor(data, { parent }) {
    super(data, { col: 'roulette', parent });
    this.broadcastableFields(['_id', 'value', 'subtype', 'eventData', 'lastRollTime', 'sectors']);

    const sectors = data.sectors || [
      ...['0', '32', '15', '19', '4', '21', '2', '25', '17', '34', '6', '27', '13'],
      ...['36', '11', '30', '8', '23', '10', '5', '24', '16', '33', '1', '20', '14'],
      ...['28', '12', '35', '3', '26', '31', '9', '22', '18', '29', '7'],
    ];
    const initialValue = data.value || sectors[0];
    const { subtype, eventData = {}, lastRollTime = 0 } = data;
    const settings = data.settings || {};
    this.set({ value: initialValue, sectors, subtype, eventData, lastRollTime, settings });
  }

  spin({ toValue = null, skipValues = [] } = {}) {
    const sectors = Array.isArray(this.sectors) ? this.sectors : [];
    const sectorsLength = sectors.length;
    const blockedValues = new Set((skipValues || []).map((v) => String(v)));
    let skipped = [];

    let value = toValue || sectors[Math.floor(Math.random() * sectorsLength)];
    if (!toValue && sectorsLength && blockedValues.size) {
      let idx = sectors.indexOf(value);
      if (idx < 0) idx = 0;
      while (blockedValues.has(String(sectors[idx])) && skipped.length < sectorsLength) {
        skipped.push(sectors[idx]);
        idx = (idx + 1) % sectorsLength;
      }
      value = sectors[idx];
    }

    this.set({
      value,
      lastRollTime: Date.now(),
      eventData: { toValue: toValue ? Date.now() + Math.random() : null },
    });

    return { skipped };
  }
});
