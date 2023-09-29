() =>
  class GameSession extends lib.user.session() {
    getUserClass() {
      return lib.game.userClass();
    }
  };
