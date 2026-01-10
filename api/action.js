async (context, actionData) => {
  const { sessionId } = context.session.state;
  const session = lib.store('session').get(sessionId);
  const game = lib.store('game').get(session.gameId);

  await game.handleAction({ ...actionData, sessionUserId: session.userId });

  return { status: 'ok' };
};
