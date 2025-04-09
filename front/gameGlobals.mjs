import { reactive, provide, inject } from 'vue';
import { addMouseEvents, removeMouseEvents, resetMouseEventsConfig } from './gameMouseEvents.mjs';

function prepareGameGlobals({ gameCustomArgs = {} } = {}) {
  const gameState = reactive({
    gameId: '',
    sessionPlayerId: '',
    sessionViewerId: '',
    viewerMode: false,
    serverTimeDiff: 0,
    shownCard: '',
    cardWorkerAction: {},
  });

  const gameCustom = reactive({
    ...gameCustomArgs,
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
  function getGame(gameId) {
    if (!gameId) gameId = gameState.gameId;
    return this.$root.state.store.game?.[gameId] || {};
  }
  function gameFinished() {
    return this.getGame().status === 'FINISHED';
  }
  function getGamePlaneOffsets() {
    const deviceOffset = this.$root.state.isMobile ? (this.$root.state.isLandscape ? 0 : -100) : 500;
    return { x: 0 + deviceOffset, y: 0 };
  }
  function resetPlanePosition() {
    // если this.getGamePlaneOffsets вызывать не через this, то потеряется ссылка на this.$root
    const { x, y } = this.getGamePlaneOffsets();
    gameCustom.gamePlaneTranslateX = -1 * x;
    gameCustom.gamePlaneTranslateY = -1 * y;
  }
  function updateGamePlaneTranslate({ x, y }) {
    this.resetPlanePosition();
    this.gameCustom.gamePlaneTranslateX += x;
    this.gameCustom.gamePlaneTranslateY += y;
  }
  function getStore() {
    return this.getGame().store || {};
  }
  function sessionPlayer() {
    return this.store.player?.[this.gameState.sessionPlayerId] || { eventData: {} };
  }
  function sessionPlayerIsActive() {
    return this.sessionPlayer().active;
  }

  const gameGlobals = {
    addMouseEvents,
    removeMouseEvents,
    resetMouseEventsConfig,
    handleGameApi,
    playerGameId,
    getGame,
    gameFinished,
    getGamePlaneOffsets,
    resetPlanePosition,
    updateGamePlaneTranslate,
    getStore,
    gameState,
    gameCustom,
    currentRound() {
      return this.game?.round;
    },
    sessionPlayer,
    sessionPlayerIsActive,
    actionsDisabled() {
      return this.sessionPlayer().eventData?.actionsDisabled;
    },
  };

  return gameGlobals;
}
export { prepareGameGlobals };
