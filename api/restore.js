async (context, { gameType, gameId, needLoadGame }) => {
  // восстановление игры из lobby

  const handleError = async (user) => {
    user.set({
      gameId: null,
      playerId: null,
      helper: {
        text: 'Действие отменено (попытка восстановления завершенной игры).',
        buttons: [{ text: 'Понятно, спасибо', action: 'exit' }],
      },
    });

    await user.saveChanges();

    return { status: 'error', returnToLobby: true };
  };

  const joinGame = async ({ game, user, playerId, viewerId, teamId } = {}) => {
    const joinData = { userId: user.id(), playerId, viewerId, teamId };

    if (viewerId) {
      await game.viewerJoin(joinData);
    } else {
      const { playerId } = (await game.playerJoin(joinData)) || {};
      await user.joinGame({ restoreAction: true, gameId: game.id(), playerId });
    }
  };

  const loadAndJoinGame = async ({ gameType, gameId, lobbyId, user, playerId, viewerId, teamId } = {}) => {
    try {
      const loadGameAction = domain.game.actions.loadGame || lib.game.actions.loadGame;
      const game = await loadGameAction({ gameType, gameId, lobbyId });
      await joinGame({ game, user, playerId, viewerId, teamId });
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

  const { lobbyId } = session;
  let { playerId, viewerId, teamId } = user;
  if (!playerId && user.lastGames?.length) playerId = user.lastGames.find((g) => g.gameId === gameId)?.playerId;

  if (needLoadGame) {
    return loadAndJoinGame({ gameType, gameId, lobbyId, user, playerId, viewerId, teamId });
  }

  const redisData = await db.redis.hget('games', gameId, { json: true });

  if (!redisData) return handleError(user, 'Попытка восстановления удаленной игры.');

  if (redisData.restorationMode) {
    const game = lib.store('game').get(gameId);
    await joinGame({ game, user, playerId, viewerId, teamId });
    return { status: 'ok' };
  }

  try {
    await user.joinGame({ gameId, playerId, viewerId, teamId, checkTutorials: false });
  } catch (err) {
    if (err === 'bad_game_data') return handleError(user, 'Некорректные данные игры');
    throw err;
  }
  return { status: 'ok' };
};
