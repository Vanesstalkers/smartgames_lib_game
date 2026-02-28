async (context) => {
  const { sessionId } = context.session.state;
  const session = lib.store('session').get(sessionId);
  const user = session.user();
  return { games: user.lastGames.sort((a, b) => a.addTime - b.addTime) };
};
