import { reactive, provide, inject } from 'vue';

function prepareGameGlobals() {
  const gameState = reactive({
    gameId: '',
    sessionPlayerId: '',
    sessionViewerId: '',
    viewerMode: false,
    serverTimeDiff: 0,
    shownCard: '',
  });

  async function handleGameApi(data, { onSuccess, onError } = {}) {
    if (!onError) onError = prettyAlert;
    await api.action
      .call({ path: 'game.api.action', args: [data] })
      .then(onSuccess)
      .catch(onError);
  }
  function playerGameId() {
    return gameState.gameId;
  }
  function getGame() {
    return this.$root.state.store.game?.[gameState.gameId] || {};
  }
  function gameFinished() {
    return this.getGame().status === 'FINISHED';
  }
  function getGamePlaneOffsets() {
    const deviceOffset = this.$root.state.isMobile ? (this.$root.state.isLandscape ? 0 : -100) : 500;
    return {
      [gameState.gameId]: { x: 0 + deviceOffset, y: 0 },
    };
  }
  function getStore() {
    return this.getGame().store || {};
  }
  function sessionPlayerIsActive() {
    return (
      gameState.sessionPlayerId ===
      Object.keys(this.getGame().playerMap || {}).find((id) => this.getStore().player?.[id]?.active)
    );
  }

  const gameGlobals = {
    handleGameApi,
    playerGameId,
    getGame,
    gameFinished,
    getGamePlaneOffsets,
    getStore,
    gameState,
    currentRound() {
      return this.game?.round;
    },
    sessionPlayerIsActive,
    actionsDisabled() {
      return this.store.player?.[gameState.sessionPlayerId]?.eventData?.actionsDisabled;
    },
  };

  return gameGlobals;
}
export { prepareGameGlobals };
