(data) => {
  const result = {};
  if (data.round !== undefined) result.round = data.round;
  if (data.status !== undefined) result.status = data.status;
  if (data.deckType !== undefined) result.deckType = data.deckType;
  if (data.gameType !== undefined) result.gameType = data.gameType;
  if (data.gameConfig !== undefined) result.gameConfig = data.gameConfig;
  if (data.gameTimer !== undefined) result.gameTimer = data.gameTimer;
  if (data.playerMap !== undefined) result.playerMap = data.playerMap;

  if (data.store?.player !== undefined) {
    const players = {};
    for (const [id, val] of Object.entries(data.store.player)) {
      const player = {};
      if (val.ready !== undefined) player.ready = val.ready;
      if (Object.keys(player).length > 0) players[id] = player;
    }
    if (Object.keys(players).length > 0) result.store = { player: players };
  }
  return result;
};
