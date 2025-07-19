async ({ gameType, gameId, lobbyId, query = {} }) => {
  if (!query._id) query._id = gameId;

  const gameClassGetter = domain.game[gameType]?.class || domain.game.class;
  return await new gameClassGetter({ id: gameId })
    .load({
      fromDB: {
        ...{ id: gameId, query, fromDump: true },
        processData: function (loadedData) {
          const game = this;
          game.run('fillGameData', loadedData);
        },
      },
    })
    .then(async (game) => {
      const { deckType, gameType, gameConfig, gameTimer, playerMap } = game;
      await lib.store.broadcaster.publishAction.call(game, `lobby-${lobbyId}`, 'addGame', {
        restorationMode: true,
        ...{ gameId, gameTimer, playerMap },
        ...{ deckType, gameType, gameConfig },
      });

      game.restorationMode = true;

      await game.updateGameAtCache({
        restorationMode: true,
        id: gameId,
        deckType,
        gameType,
        workerId: application.worker.id,
        port: application.server.port,
      });
      game.run('initPlayerWaitEvents');
      game.set({ status: 'RESTORING_GAME' }); // в initPlayerWaitEvents выставляется  {status: 'WAIT_FOR_PLAYERS'}

      for (const player of game.players()) player.set({ ready: false });

      return game;
    })
    .catch((err) => {
      throw err;
    });
};
