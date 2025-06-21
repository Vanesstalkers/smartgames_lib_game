async (context, actionData) => {
  const { sessionId } = context.session.state;
  const session = lib.store('session').get(sessionId);

  actionData.sessionUserId = session.userId;
  lib.store.broadcaster.publishAction.call(session, `game-${session.gameId}`, 'handleAction', actionData);

  return { status: 'ok' };
};
