(data) => {
  const fields = [
    'round',
    'status',
    'gameCode',
    'gameType',
    'gameConfig',
    'gameTimer',
    'playerMap',
    'maxPlayersInGame',
    'minPlayersToStart',
  ];
  const result = {};

  for (const field of fields) {
    if (data[field] === undefined) continue;
    result[field] = data[field];
  }

  if (data.store?.player === undefined) return result;

  const players = Object.entries(data.store.player).reduce((acc, [id, val]) => {
    if (val === null) {
      acc[id] = null;
    } else {
      const player = {};
      if (val.ready !== undefined) player.ready = val.ready;
      if (Object.keys(player).length > 0) acc[id] = player;
    }
    return acc;
  }, {});

  if (Object.keys(players).length > 0) {
    result.store = { player: players };
  }

  return result;
};
