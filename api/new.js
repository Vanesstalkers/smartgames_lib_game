async (
  context,
  {
    deckType,
    gameType,
    gameConfig,
    gameTimer,
    teamsCount,
    playerCount,
    maxPlayersInGame,
    minPlayersToStart,
    gameRoundLimit,
    difficulty,
  }
) => {
  lib.game.flush.exec();

  const { sessionId, userId } = context.session.state;
  const session = lib.store('session').get(sessionId);
  const user = session.user();
  const { lobbyId } = session;

  try {
    const GameClassGetter = domain.game[gameType]?.class || domain.game.class;
    const game = await new GameClassGetter().create({
      ...{ deckType, gameType, gameConfig, gameTimer, gameRoundLimit, difficulty },
      ...{ teamsCount, playerCount, maxPlayersInGame, minPlayersToStart },
    });
    const gameId = game.id();

    for (const session of user.sessions()) {
      // на случай повторного вызова api до обработки playerJoin
      // (session.saveChanges будет выполнен в user.joinGame)
      session.set({ gameId });
    }

    const publishData = { userId, userName: user.getName() }; // userName нужно для логов
    await game.playerJoin(publishData);

    lib.store.broadcaster.publishAction.call(session, `lobby-${lobbyId}`, 'addGame', {
      gameId,
      creator: { userId: user.id(), tgUsername: user.tgUsername },
      ...{ deckType, gameType, gameConfig, gameTimer, gameRoundLimit, difficulty, playerMap: game.playerMap },
    });

    return { status: 'ok', gameId };
  } catch (err) {
    if (err === 'player_count_not_exists') {
      user.set({
        gameId: null,
        playerId: null,
        helper: {
          text: 'Для создания игры необходимо указать количество игроков.',
          buttons: [{ text: 'Понятно, спасибо', action: 'exit' }],
        },
      });
      await user.saveChanges();
    } else {
      console.error(err);
      context.client.emit('action/emit', {
        eventName: 'alert',
        data: { message: err.message, stack: err.stack },
      });
    }
    return { status: 'error', logout: true };
  }
};
