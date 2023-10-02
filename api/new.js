async (context, { deckType, gameType, gameConfig, gameTimer }) => {
  const { sessionId, userId } = context.session.state;
  const session = lib.store('session').get(sessionId);
  const { lobbyId } = session;
  const { tgUsername } = session.user();

  if (!lobbyId) throw new Error('lobby not found'); // этой ошибки быть не должно - оставил проверку для отладки

  const game = await new domain.game.class().create({ deckType, gameType, gameConfig, gameTimer });

  lib.store.broadcaster.publishAction(`lobby-${lobbyId}`, 'addGame', {
    creator: { tgUsername, userId },
    id: game.id(),
    deckType,
    gameType,
    gameConfig,
    gameTimer,
  });

  processOwner = { f: `game.api.new` };
  await lib.store.broadcaster.publishData(
    `user-${userId}`,
    {
      lobbyGameConfigs: { active: { deckType, gameType, gameConfig, gameTimer } },
    },
    processOwner
  );

  return { status: 'ok', gameId: game.id() };
};
