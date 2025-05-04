async (context, { } = {}) => {
  const { sessionId } = context.session.state;
  const session = lib.store('session').get(sessionId);
  const { userId, gameId: currentGameId, viewerId } = session;
  if (!currentGameId) throw new Error('Не участвует в игре');

  const gameLoaded = await db.redis.hget('games', currentGameId);
  if (gameLoaded) {
    if (viewerId) lib.store.broadcaster.publishAction(`game-${currentGameId}`, 'viewerLeave', { userId, viewerId });
    else lib.store.broadcaster.publishAction(`game-${currentGameId}`, 'playerLeave', { userId });
  } else {
    // игра была удалена вместе с каналом
    session.user().leaveGame();
  }

  return { status: 'ok' };
};
