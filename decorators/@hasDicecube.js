({
  decorate: () => ({
    addDicecube(data, { diceKey = 'dicecubeMap', dicecubeClass, parentDirectLink = true } = {}) {
      const defaultClasses = this.defaultClasses ? this.defaultClasses() : this.game().defaultClasses();
      const { Dicecube: defaultDicecubeClass } = defaultClasses;
      if (!dicecubeClass) dicecubeClass = defaultDicecubeClass;

      if (!data.settings) data.settings = {};
      data.settings.parentDiceKey = diceKey;

      const cube = new dicecubeClass(data, { parent: this });

      this.set({ [diceKey]: { [cube._id]: {} }, dicecubes: {} });
      if (parentDirectLink && cube.subtype) {
        if (!this.dicecubes) this.dicecubes = {};
        this.dicecubes[cube.subtype] = cube;
      }
      return cube;
    },
    deleteDicecube(cube) {
      cube.deleteFromParentsObjectStorage();

      const { parentDiceKey } = cube.settings;
      this.set({ [parentDiceKey]: { [cube._id]: null } });

      if (cube.subtype) delete this.dicecubes[cube.subtype];
    },
    rollAllDicecubes() {
      for (const cube of Object.values(this.dicecubes)) {
        cube.roll();
      }
    },
  }),
});
