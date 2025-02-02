({
  statsOnStart: null,
  list: [],
  exec() {
    const heapStats = node.v8.getHeapStatistics();
    if (!lib.game.flush.statsOnStart) {
      lib.game.flush.statsOnStart = heapStats;
      console.debug(new Date(), 'memory control (heap on start)', heapStats);
    }

    for (let game of lib.game.flush.list) {
      for (const objMap of Object.values(game.store)) {
        for (const obj of Object.values(objMap)) {
          for (let key in obj) {
            delete obj[key];
          }
        }
      }
      for (let key in game) {
        delete game[key];
      }
      game = null;
    }
    lib.game.flush.list.length = 0; // удаляем все элементы из массива

    console.debug(new Date(), 'memory control', lib.utils.calcObjDifference(lib.game.flush.statsOnStart, heapStats));
  },
});
