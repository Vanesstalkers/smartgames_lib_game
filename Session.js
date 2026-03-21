() =>
  class GameSession extends lib.lobby.Session() {
    getUserClass() {
      return lib.game.User();
    }
  };
