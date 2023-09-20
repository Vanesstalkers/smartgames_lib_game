async (context, { lastItemTime } = {}) => {
  const { sessionId } = context.session.state;
  const session = lib.store('session').get(sessionId);
  const { userId, gameId: currentGameId } = session;
  if (!currentGameId) throw new Error('Не участвует в игре');

  lib.store.broadcaster.publishAction(`game-${currentGameId}`, 'showLogs', { sessionId, userId, lastItemTime });

  return { status: 'ok' };
};
