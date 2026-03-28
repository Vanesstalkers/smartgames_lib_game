({
  decorate: () => ({
    addRoulette(data, { rouletteKey = 'rouletteMap', rouletteClass, parentDirectLink = true } = {}) {
      const defaultClasses = this.defaultClasses ? this.defaultClasses() : this.game().defaultClasses();
      const { Roulette: defaultRouletteClass } = defaultClasses;
      if (!rouletteClass) rouletteClass = defaultRouletteClass;

      if (!data.settings) data.settings = {};
      data.settings.parentRouletteKey = rouletteKey;

      const wheel = new rouletteClass(data, { parent: this });

      this.set({ [rouletteKey]: { [wheel._id]: {} }, roulettes: {} });
      if (parentDirectLink && wheel.subtype) {
        if (!this.roulettes) this.roulettes = {};
        this.roulettes[wheel.subtype] = wheel;
      }
      return wheel;
    },
    deleteRoulette(wheel) {
      wheel.deleteFromParentsObjectStorage();

      const { parentRouletteKey } = wheel.settings;
      this.set({ [parentRouletteKey]: { [wheel._id]: null } });

      if (wheel.subtype) delete this.roulettes[wheel.subtype];
    },
    rollAllRoulettes() {
      for (const rouletteId of Object.keys(this.rouletteMap || {})) {
        const wheel = this.get(rouletteId);
        if (wheel?.matches?.({ className: 'Roulette' })) wheel.spin();
      }
    },
  }),
});
