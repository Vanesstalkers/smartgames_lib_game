import { reactive, provide, inject } from 'vue';
import { addMouseEvents, removeMouseEvents, resetMouseEventsConfig } from './gameMouseEvents.mjs';

function prepareGameGlobals({ gameCustomArgs = {}, defaultDeviceOffset = 500 } = {}) {
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
    selectedCard: '',
    gamePlaneTranslateX: 0,
    gamePlaneTranslateY: 0,
    gamePlaneRotation: 0,
    gamePlaneTransformOrigin: {},
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
    const deviceOffset = this.$root.state.isMobile ? (this.$root.state.isLandscape ? 0 : -100) : defaultDeviceOffset;
    return { x: 0 + deviceOffset, y: 0 };
  }
  function resetPlanePosition() {
    // если this.getGamePlaneOffsets вызывать не через this, то потеряется ссылка на this.$root
    const { x, y } = this.getGamePlaneOffsets();
    this.gameCustom.gamePlaneTranslateX = -1 * x;
    this.gameCustom.gamePlaneTranslateY = -1 * y;
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
  function sessionUserData() {
    return this.$root.state.store?.user?.[this.$root.state.currentUser] || {};
  }

  function logItems() {
    const items = Object.entries(this.game.logs || {})
      .map(([id, item]) => {
        item.msg = item.msg.replace(/<player\s*([^>]*)>([\S\s]+?)<\/player>/g, '<a $1>$2</a>');
        return [id, item];
      })
      .reverse();
    return items || [];
  }
  function getCardCustomStyle(component) {
    const {
      state: { serverOrigin },
      card,
      game,
      cardGroup,
      imgFullPath,
      imgExt = 'jpg',
    } = component;
    const rootPath = `${serverOrigin}/img/cards/${game.templates.card}`;
    const { group, name } = card;

    const cardPath = [cardGroup || group, name || 'back-side'].filter((s) => s).join('/');
    const path = imgFullPath || `${rootPath}/${cardPath}.${imgExt}` || `empty-card.${imgExt}`;

    return {
      backgroundImage: `url(${path})`,
    };
  }

  const gameGlobals = {
    addMouseEvents,
    removeMouseEvents,
    resetMouseEventsConfig,
    handleGameApi,
    playerGameId,
    getGame,
    sessionUserData,
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
      return this.sessionPlayer().eventData?.actionsDisabled; // например пропуск хода
    },
    logItems,
    getCardCustomStyle,
  };

  return gameGlobals;
}
export { prepareGameGlobals };
