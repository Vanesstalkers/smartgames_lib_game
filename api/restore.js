async (context, { deckType, gameType, gameId, needLoadGame }) => { // восстановление игры из lobby

  const handleError = async (user, message) => {
    user.set({
      gameId: null, playerId: null,
      helper: {
        text: 'Действие отменено (попытка восстановления завершенной игры).',
        buttons: [{ text: 'Понятно, спасибо', action: 'exit' }],
      },
    });

    await user.saveChanges({ saveToLobbyUser: true });

    return { status: 'error', logout: true };
  };

  const joinGame = async (game, user, playerId, viewerId) => {
    const joinData = { userId: user.id(), playerId, viewerId };

    if (viewerId) {
      await game.viewerJoin(joinData);
    } else {
      await game.playerJoin(joinData);
    }
  };

  const loadAndJoinGame = async (gameType, gameId, lobbyId, user, playerId, viewerId) => {
    try {
      const loadGameAction = domain.game.actions.loadGame || lib.game.actions.loadGame;
      const game = await loadGameAction({ gameType, gameId, lobbyId });
      await joinGame(game, user, playerId, viewerId);
      return { status: 'ok' };
    } catch (err) {
      if (err === 'not_found') {
        return handleError(user);
      }
      throw err;
    }
  };

  const { sessionId } = context.session.state;
  const session = lib.store('session').get(sessionId);
  const user = session.user();

  if (user.gameId && user.gameId !== gameId) {
    return handleError(user);
  }

  const { playerId, viewerId } = user;
  const { lobbyId } = session;

  if (needLoadGame) {
    return loadAndJoinGame(gameType, gameId, lobbyId, user, playerId, viewerId);
  }

  const redisData = await db.redis.hget('games', gameId, { json: true });
  const { id, restorationMode, notFound } = redisData;

  if (notFound) {
    return handleError(user, 'Попытка восстановления удаленной игры.');
  }

  if (restorationMode) {
    const game = lib.store('game').get(gameId);
    await joinGame(game, user, playerId, viewerId);
    return { status: 'ok' };
  }

  await user.joinGame({ gameId, playerId, viewerId, deckType, gameType, checkTutorials: false });
  return { status: 'ok' };
};
