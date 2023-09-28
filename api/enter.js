async (context, { gameId }) => {
  const { sessionId } = context.session.state;
  const session = lib.store('session').get(sessionId);
  const user = session.user();
  if (gameId && gameId !== user.gameId) throw new Error('Пользователь не участвует в игре');

  const gameLoaded = await db.redis.hget('games', gameId);
  if (!gameLoaded) {
    user.set({ gameId: null, playerId: null, viewerId: null });
    await user.saveChanges();
    throw new Error('Игра была отменена');
  }

  user.subscribe(`game-${gameId}`, { rule: 'actions-only' });
  session.subscribe(`game-${gameId}`, {
    rule: 'vue-store',
    userId: user.id(),
    viewerMode: user.viewerId ? true : false,
  });
  session.onClose.push(async () => {
    // проверка на последнего игрока не нужна, потому что игра автоматически завершится через allowedAutoCardPlayRoundStart раундов

    session.unsubscribe(`game-${gameId}`);
  });

  return {
    status: 'ok',
    gameId,
    playerId: user.playerId,
    viewerId: user.viewerId,
  };
};
