(class Viewer extends lib.game.GameObject {
  constructor(data, { parent }) {
    super(data, { col: 'viewer', parent });
    this.broadcastableFields(['_id', 'userId', 'isViewer', 'gameMaster', 'avatarCode', 'avatarUrl']);

    this.set({
      userId: data.userId,
      isViewer: true,
      gameMaster: data.gameMaster,
      avatarCode: data.avatarCode,
      avatarUrl: data.avatarUrl,
    });
  }
});
