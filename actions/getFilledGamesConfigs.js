() => {
  const gameTypes = domain.game.configs.games();
  const filled = {};
  for (const [gameType, typeData] of Object.entries(gameTypes)) {
    const { items, itemsDefault = {}, ...typeInfo } = typeData;
    filled[gameType] = typeInfo;
    filled[gameType].items = {};
    for (const [gameConfig, configData] of Object.entries(items)) {
      filled[gameType].items[gameConfig] = Object.assign({}, itemsDefault, configData);
    }
  }
  return filled;
};
