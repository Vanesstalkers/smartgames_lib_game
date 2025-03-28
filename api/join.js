async (context, { gameId, viewerMode = false }) => {
  const { sessionId } = context.session.state;
  const session = lib.store('session').get(sessionId);
  const { userId } = session;
  const user = session.user();
  if (user.gameId) throw new Error('Уже подключен к другой игре');

  for (const session of user.sessions()) {
    // на случай повторного вызова api до обработки playerJoin
    // (session.saveChanges будет выполнен в user.joinGame)
    session.set({ gameId });
  }

  // PIPELINE_GAME_START (5) :: делаем публикацию о появлении у игры нового игрока 
  const action = viewerMode ? 'viewerJoin' : 'playerJoin';
  lib.store.broadcaster.publishAction(`game-${gameId}`, action, {
    userId,
    userName: user.name || user.login,
    userAvatar: user.avatarCode,
  });
  return { status: 'ok' };
};
