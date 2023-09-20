(class Viewer extends lib.game.GameObject {
  constructor(data, { parent }) {
    super(data, { col: 'viewer', parent });
    this.broadcastableFields(['_id', 'userId', 'isViewer', 'avatarCode']);

    this.set({
      userId: data.userId,
      isViewer: true,
      avatarCode: data.avatarCode,
    });
  }
});
