async (context, { deckType, gameType, gameConfig, gameTimer }) => {
  const { sessionId, userId } = context.session.state;
  const session = lib.store('session').get(sessionId);
  const { lobbyId } = session;

  if (!lobbyId) throw new Error('lobby not found'); // этой ошибки быть не должно - оставил проверку для отладки

  const game = await new domain.game.class().create({ deckType, gameType, gameConfig, gameTimer });

  lib.store.broadcaster.publishAction.call(session, `lobby-${lobbyId}`, 'addGame', {
    creator: { userId: user.id(), tgUsername: user.tgUsername },
    ...{ id: game.id(), deckType, gameType, gameConfig, gameTimer },
  });

  await lib.store.broadcaster.publishData.call(session, `user-${userId}`, {
    lobbyGameConfigs: { active: { deckType, gameType, gameConfig, gameTimer } },
  });

  return { status: 'ok', gameId: game.id() };
};
