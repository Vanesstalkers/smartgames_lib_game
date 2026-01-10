async (context, { gameId, viewerMode = false, ...args }) => {
  const { sessionId } = context.session.state;
  const session = lib.store('session').get(sessionId);
  const { userId } = session;
  const user = session.user();
  if (user.gameId && user.gameId !== gameId) {
    lib.store.broadcaster.publishAction.call(session, `user-${userId}`, 'broadcastToSessions', {
      data: { message: 'Уже подключен к другой игре. Требуется повторить попытку подключения.' },
    });
    return { status: 'error', logout: true };
  }

  const game = lib.store('game').get(gameId);
  const data = { userId, userName: user.getName(), ...args }; // userName нужно для логов

  for (const session of user.sessions()) {
    // на случай повторного вызова api до обработки playerJoin
    // (session.saveChanges будет выполнен в user.joinGame)
    session.set({ gameId });
  }

  if (viewerMode) await game.viewerJoin(data);
  else await game.playerJoin(data);

  return { status: 'ok' };
};
