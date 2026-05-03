<template>
  <div
    v-if="gameDataLoaded"
    id="game"
    :type="game.gameType"
    :config="game.gameConfig"
    :class="[
      debug ? 'debug' : '',
      state.isMobile ? 'mobile-view' : '',
      state.isLandscape ? 'landscape-view' : 'portrait-view',
      gameState.viewerMode ? 'viewer-mode' : '',
      backgroundReady ? 'bg-ready' : '',
    ]"
    :style="{ '--game-bg-url': `url(${gameBackgroundUrl})` }"
    @wheel.prevent="zoomGamePlane"
  >
    <slot name="helper-guru" :menuWrapper="menuWrapper" :menuButtonsMap="menuButtonsMap">
      <tutorial :game="game" class="scroll-off" :customMenu="customMenu({ menuWrapper, menuButtonsMap })" />
    </slot>

    <GUIWrapper
      :pos="['top', 'left']"
      :offset="{ top: 20, left: state.isMobile ? 60 : [60, 80, 110, 130, 160, 190][state.guiScale] }"
      :contentClass="['gui-small']"
      :wrapperStyle="{ zIndex: 5 }"
    >
      <div class="game-controls" style="display: flex">
        <div
          :class="['chat', 'gui-btn', showChat ? 'active' : '', unreadMessages ? 'unread-messages' : '']"
          v-on:click="toggleChat"
        />
        <div :class="['log', 'gui-btn', showLog ? 'active' : '']" v-on:click="toggleLog" />
        <div
          :class="['move', 'gui-btn']"
          v-on:click="
            resetPlanePosition();
            resetMouseEventsConfig();
            updatePlaneScale();
          "
        />
      </div>
    </GUIWrapper>

    <div :class="['chat-content', 'scroll-off', showChat ? 'visible' : '']">
      <slot name="chat" :isVisible="showChat" :hasUnreadMessages="hasUnreadMessages">
        <chat
          :defActiveChannel="`game-${gameState.gameId}`"
          :userData="userData"
          :isVisible="showChat"
          :hasUnreadMessages="hasUnreadMessages"
          :channels="chatChannels"
        />
      </slot>
    </div>

    <div v-if="showLog" class="log-content scroll-off">
      <div v-for="[id, logItem] in logItems()" :key="id" class="log-item">
        <span class="time">[ {{ new Date(logItem.time).toTimeString().split(' ')[0] }} ]</span> ::
        <span v-html="logItem.msg" />
      </div>
    </div>

    <div v-if="state.shownCard?.code" class="shown-card scroll-off" v-on:click.self="closeCardInfo">
      <div class="close" v-on:click.stop="closeCardInfo" />
      <div class="shown-card-scene" v-on:click.stop="toggleShownCardFlip" :style="shownCardSceneStyle">
        <div :class="['shown-card-flipper', { 'is-flipped': shownCardFlipped }]">
          <div class="shown-card-face shown-card-face--front" :style="shownCardBackFaceStyle" />
          <div class="shown-card-face shown-card-face--back" :style="state.shownCard.style" />
        </div>
      </div>
      <!-- <div
        v-if="shownCardFlipped"
        :class="{ 'hidden-card-info': true, 'hidden-card-info-visible': visibleCardInfo[state.shownCard?.code] }"
        @click.stop="showHiddenCardInfo(state.shownCard?.code)"
      ></div> -->
    </div>

    <div
      id="gamePlane"
      :style="{
        ...gamePlaneCustomStyleData, // например, центровка по координатам блоков в release
        ...gamePlaneControlStyle, // mouse-events + принудительный сдвиг (например, для корпоративных игр)
      }"
    >
      <slot name="gameplane" :gamePlaneScale="gamePlaneScale" />
    </div>

    <GUIWrapper id="gameInfo" :pos="['top', 'right']" :offset="{}">
      <slot name="gameinfo" />
    </GUIWrapper>

    <GUIWrapper class="session-player" :pos="['bottom', 'right']">
      <slot name="player" />
    </GUIWrapper>
    <GUIWrapper
      class="players"
      :pos="state.isMobile && state.isPortrait ? ['top', 'right'] : ['bottom', 'left']"
      :offset="state.isMobile && state.isPortrait ? { top: 200 } : {}"
      :contentClass="['gui-small']"
    >
      <slot name="opponents" />
    </GUIWrapper>
  </div>
</template>

<script>
import { provide, inject } from 'vue';
import { prepareGameGlobals } from './gameGlobals.mjs';
import { addEvents, removeEvents } from './gameEvents.mjs';
// import { addMouseEvents, removeMouseEvents, config as mouseEventsConfig } from './gameMouseEvents.mjs';

import GUIWrapper from '@/components/gui-wrapper.vue';
import tutorial from '~/lib/helper/front/helper.vue';
import chat from '~/lib/chat/front/chat.vue';
import gameBgUrl from './assets/bg-game.png';

export default {
  components: {
    GUIWrapper,
    tutorial,
    chat,
  },
  props: {
    defaultPlaneScale: Number,
    planeScaleMin: {
      Number,
      default: 0.3,
    },
    planeScaleMax: {
      type: Number,
      default: 2,
    },
    gamePlaneScaleFactor: {
      type: Number,
      default: 0.5,
    },
    gamePlaneScaleFactorMobile: {
      type: Number,
      default: 0.7,
    },
    gamePlaneFillWidth: {
      type: Number,
      default: 0,
    },
    debug: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      showChat: false,
      unreadMessages: 0,
      showLog: false,
      gamePlaneCustomStyleData: {},
      gamePlaneScale: 1,
      gamePlaneScaleMin: this.planeScaleMin,
      gamePlaneScaleMax: this.planeScaleMax,
      planeScaleNeedUpdated: 0,
      resizeObserver: null,
      zoomAccumulatedDelta: 0,
      zoomLastResetTime: 0,
      backgroundReady: false,
      gameBackgroundUrl: gameBgUrl,
      tutorialActions: {
        leaveGame: async () => {
          await api.action.call({ path: 'game.api.leave', args: [] }).catch(prettyAlert);
        },
      },
      visibleCardInfo: {},
      shownCardFlipped: false,
    };
  },
  setup: function () {
    return inject('gameGlobals', prepareGameGlobals);
  },

  computed: {
    state() {
      return this.$root.state || {};
    },
    store() {
      return this.getStore() || {};
    },
    gamePlaneControlStyle() {
      // двигаем по XY сам gamePlane
      const transform = [];

      const { gamePlaneTranslateX, gamePlaneTranslateY } = this.gameCustom;
      transform.push('translate(' + gamePlaneTranslateX + 'px, ' + gamePlaneTranslateY + 'px)');
      return { transform: transform.join(' '), scale: this.gamePlaneScale };
    },
    game() {
      return this.getGame();
    },
    gameDataLoaded() {
      return this.game.addTime;
    },
    userData() {
      return this.sessionUserData();
    },
    lobby() {
      return this.state.store.lobby?.[this.state.currentLobby] || {};
    },
    chatChannels() {
      return {
        [`game-${this.gameState.gameId}`]: {
          name: 'Игровой чат',
          users: this.chatUsers,
          items: this.game.chat,
          inGame: true,
        },
        [`lobby-${this.state.currentLobby}`]: {
          name: 'Общий чат',
          users: this.lobby.users || {},
          items: this.lobby.chat || {},
        },
      };
    },
    chatUsers() {
      return Object.values(this.store.player)
        .concat(Object.values(this.store.viewer || {}))
        .reduce((obj, { userId, isViewer }) => {
          let user = { ...this.lobby.users?.[userId] };
          if (isViewer) user.name = `${user.name || 'Гость'} (наблюдатель)`;
          return Object.assign(obj, { [userId]: user });
        }, {});
    },
    shownCardSceneStyle() {
      const clientHeight = this.$root.$el.clientHeight;
      const clientWidth = this.$root.$el.clientWidth;
      const isLandscape = this.state.isLandscape;
      const isMobile = this.state.isMobile;

      let width, height, top, left;

      if (isLandscape) {
        height = '100%';
        width = (125 * clientHeight) / 192;
        left = `calc(50% - ${width / 2}px)`;
        width = `${width}px`;
      } else {
        width = '100%';
        height = (192 * clientWidth) / 125;
        top = `calc(50% - ${height / 2}px)`;
        height = `${height}px`;
      }
      return { width, height, top, left };
    },
    shownCardBackFaceStyle() {
      const id = this.state.shownCard?.id;
      const cardFromStore = id ? this.store.card?.[id] : null;
      const group = cardFromStore?.group || 'client';
      const bg = this.state.shownCard?.style?.backgroundImage || '';
      const m = typeof bg === 'string' && bg.match(/\.(jpg|jpeg|png|webp)/i);
      const imgExt = m ? m[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg';
      return this.getCardCustomStyle({
        state: this.state,
        card: { group, name: 'back-side' },
        game: this.game,
        imgExt,
      });
    },
  },
  watch: {
    'state.shownCard.code'() {
      this.shownCardFlipped = false;
    },
    'state.shownCard.id': function (cardId) {
      console.log('state.shownCard.id=', cardId);
      if (!cardId) return;
      api.action.call({ path: 'helper.api.action', args: [{ tutorial: { cardId } }] }).catch(prettyAlert);
    },
    gameDataLoaded: function () {
      this.$set(this.$root.state, 'viewLoaded', true);
      this.resetPlanePosition();
    },
    'game.round': function () {
      this.$set(this.$root.state, 'selectedDiceSideId', '');
    },
    'state.isLandscape': function () {
      this.updatePlaneScale();
    },
    'state.isFullscreen': function () {
      setTimeout(() => {
        // $nextTick не помогает
        this.updatePlaneScale();
      }, 100);
    },
    'state.gamePlaneNeedUpdate': function () {
      setTimeout(this.updatePlaneScale, 100);
    },
  },
  methods: {
    menuWrapper({ buttons }) {
      return tutorial.menuWrapper(this.userData)({ buttons });
    },
    menuButtonsMap() {
      return tutorial.menuButtonsMap(this.tutorialActions);
    },
    customMenu() {
      const menuWrapper = tutorial.menuWrapper(this.userData);
      const menuButtonsMap = tutorial.menuButtonsMap(this.tutorialActions);

      const { cancel, restore, tutorials, helperLinks, leave } = menuButtonsMap;
      const fillTutorials = tutorials({
        showList: [
          { title: 'Стартовое приветствие игры', action: { tutorial: 'game-tutorial-start' } },
          { title: 'Управление игровым полем', action: { tutorial: 'game-tutorial-gamePlane' } },
        ],
      });

      return menuWrapper({
        buttons: [cancel(), restore(), fillTutorials, helperLinks({ inGame: true }), leave()],
      });
    },
    updatePlaneScale() {
      this.state.gamePlaneNeedUpdate = false;

      if (this.$el instanceof HTMLElement) {
        const { innerWidth, innerHeight } = window;
        const isMobile = this.state.isMobile;

        const gamePlaneRotation = this.gameCustom.gamePlaneRotation;
        this.gameCustom.gamePlaneRotation = 0; // если не обнулять, то будет мешаться при центровке поля
        const gamePlaneTranslateX = this.gameCustom.gamePlaneTranslateX;
        const gamePlaneTranslateY = this.gameCustom.gamePlaneTranslateY;

        const restoreGamePlaneSettings = () => {
          this.gameCustom.gamePlaneRotation = gamePlaneRotation;
          this.gameCustom.gamePlaneTranslateX = gamePlaneTranslateX;
          this.gameCustom.gamePlaneTranslateY = gamePlaneTranslateY;
        };

        const $gamePlane = this.$el.querySelector('#gamePlane');
        let { width, height } = $gamePlane.getBoundingClientRect();
        width = width / this.gamePlaneScale;
        height = height / this.gamePlaneScale;

        const value = Math.min(innerWidth / width, innerHeight / height);
        if (value > 0) {
          this.gamePlaneScale = 1;
          this.$nextTick(() => {
            const fillScale = Array.from($gamePlane.childNodes)
              .reduce((acc, child) => acc.concat(Array.from(child.childNodes)), [])
              .reduce(
                (acc, child) => {
                  if (typeof child?.getBoundingClientRect !== 'function') return acc;

                  const { left, right } = child.getBoundingClientRect();
                  return {
                    left: !acc.left || left < acc.left ? left : acc.left,
                    right: !acc.right || right > acc.right ? right : acc.right,
                  };
                },
                { left: null, right: null }
              );

            let newGamePlaneScale = this.gamePlaneFillWidth
              ? this.gamePlaneFillWidth / ((fillScale.right - fillScale.left) / innerWidth)
              : this.defaultPlaneScale || value * this.gamePlaneScaleFactor;

            if (isMobile) newGamePlaneScale *= this.gamePlaneScaleFactorMobile;
            if (this.gamePlaneScaleMin > value && value > 0.2) this.gamePlaneScaleMin = value;
            if (newGamePlaneScale < this.gamePlaneScaleMin) newGamePlaneScale = this.gamePlaneScaleMin;
            if (newGamePlaneScale > this.gamePlaneScaleMax) newGamePlaneScale = this.gamePlaneScaleMax;

            this.$set(this, 'gamePlaneScale', newGamePlaneScale);

            this.gamePlaneCustomStyleData = {}; // сбрасываем сдвиги gamePlane, т.к. в calcFunc используется getBoundingClientRect()
            this.$nextTick(function () {
              const calcFunc = this.calcGamePlaneCustomStyleData;
              if (typeof calcFunc === 'function') {
                const calcFuncResult = calcFunc.call(this, {
                  gamePlaneScale: newGamePlaneScale,
                  isMobile,
                });
                if (calcFuncResult) this.gamePlaneCustomStyleData = calcFuncResult;

                restoreGamePlaneSettings();
              }
            });
          });
        }
      }
    },
    zoomGamePlane(event) {
      if (!window.absDeltaList) window.absDeltaList = [];
      window.absDeltaList.push(Math.abs(event.deltaY));

      const lastFourDeltas = window.absDeltaList.slice(-4);
      const firstOfLastFourDeltas = lastFourDeltas[0];
      const lastThreeDeltas = window.absDeltaList.slice(-3);
      const h = window.innerHeight / 10;
      const oneOfManySmallScrollIterations = lastThreeDeltas.find((_) => _ < h); // у chrome на одно wheel-движение приходит до 40 событий

      if (lastThreeDeltas.find((_) => _ <= firstOfLastFourDeltas) && oneOfManySmallScrollIterations) {
        window.lastDelta = window.absDeltaY;
        return;
      }
      window.lastDelta = window.absDeltaY;

      const now = Date.now();
      if (now - (window.zoomLastUpdateTime || 0) < 300) return; // обеспечивает выполнение по 1 zoom-итерации за раз (за одну прокрутку колесика может подряд прийти несколько десятков событий увеличения/уменьшения zoom)
      window.zoomLastUpdateTime = now;

      const DELTA = 0.2;
      this.gamePlaneScale += event.deltaY > 0 ? -DELTA : DELTA;

      if (this.gamePlaneScale < this.gamePlaneScaleMin) this.gamePlaneScale = this.gamePlaneScaleMin;
      if (this.gamePlaneScale > this.gamePlaneScaleMax) this.gamePlaneScale = this.gamePlaneScaleMax;
    },

    closeCardInfo() {
      this.shownCardFlipped = false;
      this.$set(this.$root.state, 'shownCard', { code: null, style: {} });
    },
    toggleShownCardFlip() {
      this.shownCardFlipped = !this.shownCardFlipped;
    },
    toggleChat() {
      this.showLog = false;
      this.showChat = !this.showChat;
    },
    async toggleLog() {
      this.showChat = false;
      if (this.showLog) return (this.showLog = false);
      this.showLog = true;
      await api.action
        .call({ path: 'game.api.showLogs', args: [{ lastItemTime: this.logItems().pop()?.[1]?.time }] })
        .then(() => {
          // если делать присвоение здесь, то будет сбрасываться tutorial-active на кнопке
          // this.showLog = true;
        })
        .catch(prettyAlert);
    },
    async callGameEnter() {
      // без этого не смогу записать gameId и playerId в context сессии
      await api.action
        .call({
          path: 'game.api.enter',
          args: [{ gameId: this.$route.params.id }],
        })
        .then(async (data = {}) => {
          const { gameId, playerId, viewerId, serverTime, restorationMode } = data;

          if (!gameId) {
            this.$router.push({ path: `/` }).catch((err) => console.error(err));
            return;
          }

          const viewerMode = viewerId ? true : false;
          this.gameState.gameId = gameId;
          this.gameState.sessionPlayerId = playerId;
          this.gameState.sessionViewerId = viewerId;
          this.gameState.viewerMode = viewerMode;
          this.$set(this.$root.state, 'serverTimeDiff', serverTime - Date.now());

          addEvents(this);
          this.addMouseEvents(this);

          if (state.iframeMode) window.parent.postMessage({ emit: { name: 'iframeEnterGame', data: {} } }, '*');
        })
        .catch((err) => {
          console.error(err);
          this.$router.push({ path: `/` }).catch((err) => {
            console.error(err);
          });
        });
    },
    hasUnreadMessages(count = 0) {
      this.unreadMessages = count;
    },
    showHiddenCardInfo(code) {
      this.$set(this.visibleCardInfo, code, true);
    },
  },
  async created() {},
  async mounted() {
    const backgroundImage = new Image();
    backgroundImage.src = this.gameBackgroundUrl;
    backgroundImage.onload = () => {
      this.backgroundReady = true;
    };

    this.$on('resetPlanePosition', this.resetPlanePosition);

    this.escKeyHandler = (e) => {
      if (e.key === 'Escape' && this.state.shownCard?.code) this.closeCardInfo();
    };
    window.addEventListener('keydown', this.escKeyHandler);

    // Настраиваем отслеживание изменений window.innerWidth
    this.$nextTick(() => {
      this.resizeObserver = () => window.innerWidth > 0 && setTimeout(this.updatePlaneScale, 100);
      window.addEventListener('resize', this.resizeObserver);

      this.resizeObserver();
    });

    if (this.state.currentLobby && this.state.currentUser) {
      this.callGameEnter();
    } else {
      this.$router.push({ path: `/` }).catch((err) => {
        console.log(err);
      });
    }
  },
  async beforeDestroy() {
    if (this.escKeyHandler) {
      window.removeEventListener('keydown', this.escKeyHandler);
      this.escKeyHandler = null;
    }
    this.$set(this.$root.state, 'viewLoaded', false);

    // Удаляем слушатель resize
    if (this.resizeObserver) {
      window.removeEventListener('resize', this.resizeObserver);
      this.resizeObserver = null;
    }

    removeEvents();
    this.removeMouseEvents();
    if (this.$root.state.store.game?.[this.gameState.gameId]) {
      delete this.$root.state.store.game[this.gameState.gameId];
    }
  },
};
</script>

<style lang="scss">
#game {
  height: 100%;
  width: 100%;
  overflow: hidden;

  &::before,
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background-position: center;
    background-repeat: no-repeat;
    background-size: cover;
    pointer-events: none;
    z-index: 0;
  }

  &::before {
    background-image: url('assets/bg-game-lqip.png');
  }

  &::after {
    background-image: var(--game-bg-url);
    opacity: 0;
    transition: opacity 360ms ease-in-out;
  }

  &.bg-ready::after {
    opacity: 1;
  }

  &.mobile-view {
    touch-action: none;
  }

  .selectable {
    cursor: pointer;
    box-shadow: inset 0 0 20px 8px yellow;
  }

  .session-player {
    z-index: 1;
  }
}

#gamePlane {
  position: relative;
  width: 100%;
  height: 100%;
  opacity: 1;
  transform-origin: center;
  z-index: 1;
}

#game.mobile-view #gamePlane {
  margin-left: -50px;
}

#game.mobile-view.landscape-view #gamePlane {
  margin-left: -100px;
}

.gui-resizeable.scale-1 {
  scale: 0.8;
}

.gui-resizeable.scale-2 {
  scale: 1;
}

.gui-resizeable.scale-3 {
  scale: 1.5;
}

.gui-resizeable.scale-4 {
  scale: 2;
}

.gui-resizeable.scale-5 {
  scale: 2.5;
}

#game.mobile-view .gui-resizeable.scale-1 {
  scale: 0.6;
}

#game.mobile-view .gui-resizeable.scale-2 {
  scale: 0.8;
}

#game.mobile-view .gui-resizeable.scale-3 {
  scale: 1;
}

#game.mobile-view .gui-resizeable.scale-4 {
  scale: 1.2;
}

#game.mobile-view .gui-resizeable.scale-5 {
  scale: 1.5;
}

.gui-resizeable.gui-small.scale-1 {
  scale: 0.6;
}

.gui-resizeable.gui-small.scale-2 {
  scale: 0.8;
}

.gui-resizeable.gui-small.scale-3 {
  scale: 1;
}

.gui-resizeable.gui-small.scale-4 {
  scale: 1.2;
}

.gui-resizeable.gui-small.scale-5 {
  scale: 1.5;
}

#game.mobile-view .gui-resizeable.gui-small.scale-1 {
  scale: 0.4;
}

#game.mobile-view .gui-resizeable.gui-small.scale-2 {
  scale: 0.6;
}

#game.mobile-view .gui-resizeable.gui-small.scale-3 {
  scale: 0.8;
}

#game.mobile-view .gui-resizeable.gui-small.scale-4 {
  scale: 1;
}

#game.mobile-view .gui-resizeable.gui-small.scale-5 {
  scale: 1.2;
}

.shown-card {
  position: fixed !important;
  z-index: 9999;
  width: 100%;
  height: 100%;
  top: 0px;
  left: 0px;
  background-image: url(@/assets/clear-grey-back.png);

  .shown-card-scene {
    position: absolute;
    perspective: 1400px;
    width: 100%;
    height: 100%;
    cursor: pointer;
  }

  .shown-card-flipper {
    position: relative;
    width: 100%;
    height: 100%;
    transform-style: preserve-3d;
    transition: transform 0.55s ease-in-out;
  }

  .shown-card-flipper.is-flipped {
    transform: rotateY(180deg);
  }

  .shown-card-face {
    position: absolute;
    inset: 0;
    backface-visibility: hidden;
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
  }

  .shown-card-face--back {
    transform: rotateY(180deg);
  }

  > .close {
    background-image: url(@/assets/close.png);
    background-color: black;
    cursor: pointer;
    position: absolute;
    top: 10px;
    right: 10px;
    width: 50px;
    height: 50px;
    border-radius: 10px;

    &:hover {
      opacity: 0.7;
    }
  }
}

#game .tutorial-active {
  box-shadow: 0 0 20px 20px #f4e205;
}

.gui-btn {
  width: 64px;
  height: 64px;
  border: 2px solid #f4e205;
  border-radius: 50%;
  background-color: black;
  background-size: 40px;
  background-repeat: no-repeat;
  background-position: center;
  margin: 10px;
  cursor: pointer;

  &.active {
    background-color: #00000055;
  }

  &:hover {
    opacity: 0.7;
  }

  &.chat {
    background-image: url(assets/chat.png);

    &.unread-messages {
      border: 2px solid #0078d7;
      box-shadow: 1px 0px 20px 6px #0078d7;
    }
  }

  &.log {
    background-image: url(assets/log.png);
  }

  &.move {
    // background-image: url(assets/move.png);
    background-image: url(assets/center.png);
  }

  &.tutorial-active {
    box-shadow: 0 0 20px 20px #f4e205;
  }
}

.mobile-view .gui-btn.move {
  // background-image: url(assets/move-mobile.png);
  background-image: url(assets/center.png);
}

.chat-content {
  z-index: 3 !important;
  position: absolute;
  left: 40px;
  top: 60px;
  width: 300px;
  height: calc(100% - 100px);
  margin: 30px;
  background-image: url(@/assets/clear-black-back.png);
  border: 2px solid #f4e205;
  color: #f4e205;
  display: none;

  &.visible {
    display: block;
  }
}

.mobile-view .chat-content {
  left: 0px;
  width: calc(100% - 40px);
  margin: 20px;
}

.log-content {
  position: fixed;
  left: 40px;
  top: 60px;
  z-index: 2 !important;
  width: calc(100% - 100px);
  height: calc(100% - 100px);
  margin: 30px;
  box-shadow: inset 0px 0px 2px 2px #f4e205;
  background-image: url(@/assets/clear-black-back.png);
  color: #f4e205;
  overflow: auto;
  text-align: left;

  .log-item {
    padding: 10px;
    line-height: 24px;

    .time {
      font-weight: bold;
      color: lightgrey;
    }

    a {
      font-weight: bold;
      color: lightblue;
    }
  }
}

.mobile-view .log-content {
  left: 0px;
  width: calc(100% - 40px);
  margin: 20px;
}

.hidden-card-info {
  position: absolute;
  width: 400px;
  height: 380px;
  top: 480px;
  left: calc(50% - 140px);
  background-image: url(data:image/png;base64,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);
  opacity: 0.85;

  &.hidden-card-info-visible {
    opacity: 0;
    transition: opacity 1s ease-in-out;
  }
}
</style>
