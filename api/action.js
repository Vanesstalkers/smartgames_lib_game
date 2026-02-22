async (context, actionData) => {
  const { sessionId } = context.session.state;
  const session = lib.store('session').get(sessionId);
  const game = lib.store('game').get(session.gameId);

  if (!game || game.status === 'FINISHED') {
    throw new Error('Действие невозможно, так как игра завершена');
  }
  if (game.status === 'RESTORING_GAME') {
    throw new Error('Действие невозможно, так как игра еще не восстановлена');
  }

  await game.handleAction({ ...actionData, sessionUserId: session.userId });

  return { status: 'ok' };
};
