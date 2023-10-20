<template>
  <div
    v-if="gameDataLoaded"
    id="game"
    :type = "game.gameType"
    :class="[
      state.isMobile ? 'mobile-view' : '',
      state.isLandscape ? 'landscape-view' : 'portrait-view',
      gameState.viewerMode ? 'viewer-mode' : '',
    ]"
    @wheel.prevent="zoomGamePlane"
  >
    <tutorial :inGame="true" class="scroll-off" />

    <GUIWrapper
      :pos="['top', 'left']"
      :offset="{ top: 20, left: state.isMobile ? 60 : [60, 80, 110, 130, 160, 190][state.guiScale] }"
      :contentClass="['gui-small']"
      :wrapperStyle="{ zIndex: 1 }"
    >
      <div class="game-controls" style="display: flex">
        <div
          :class="['chat', 'gui-btn', showChat ? 'active' : '', unreadMessages ? 'unread-messages' : '']"
          v-on:click="toggleChat"
        />
        <div :class="['log', 'gui-btn', showLog ? 'active' : '']" v-on:click="toggleLog" />
        <div :class="['move', 'gui-btn', showMoveControls ? 'active' : '']" v-on:click="toggleMoveControls" />
      </div>
      <div v-if="showMoveControls" class="gameplane-controls">
        <div class="zoom-minus" v-on:click="zoomGamePlane({ deltaY: 1 })" />
        <div class="move-top" v-on:click="gamePlaneTranslateY -= 100" />
        <div class="zoom-plus" v-on:click="zoomGamePlane({ deltaY: -1 })" />
        <div class="move-left" v-on:click="gamePlaneTranslateX -= 100" />
        <div
          class="reset"
          v-on:click="
            gamePlaneRotation = 0;
            gamePlaneTranslateX = 0;
            gamePlaneTranslateY = 0;
            updatePlaneScale();
          "
        />
        <div class="move-right" v-on:click="gamePlaneTranslateX += 100" />
        <div class="rotate-right" v-on:click="gamePlaneRotation += 15" />
        <div class="move-bottom" v-on:click="gamePlaneTranslateY += 100" />
        <div class="rotate-left" v-on:click="gamePlaneRotation -= 15" />
      </div>
    </GUIWrapper>

    <div :class="['chat-content', 'scroll-off', showChat ? 'visible' : '']">
      <chat
        :channels="{
          [`game-${gameState.gameId}`]: {
            name: 'Игровой чат',
            users: chatUsers,
            items: game.chat,
            inGame: true,
          },
          [`lobby-${state.currentLobby}`]: {
            name: 'Общий чат',
            users: this.lobby.users || {},
            items: this.lobby.chat || {},
          },
        }"
        :defActiveChannel="`game-${gameState.gameId}`"
        :userData="userData"
        :isVisible="showChat"
        :hasUnreadMessages="hasUnreadMessages"
      />
    </div>

    <div v-if="showLog" class="log-content scroll-off">
      <div v-for="[id, logItem] in Object.entries(logs).reverse()" :key="id" class="log-item">
        [ {{ new Date(logItem.time).toTimeString().split(' ')[0] }} ]:
        {{ logItem.msg }}
      </div>
    </div>

    <div v-if="state.shownCard" class="shown-card scroll-off" v-on:click.stop="closeCardInfo">
      <div class="close" v-on:click.stop="closeCardInfo" />
      <div class="img" :style="state.shownCard" />
    </div>

    <div id="gamePlane" :style="{ ...gamePlaneCustomStyleData, ...gamePlaneControlStyle }">
      <slot name="gameplane" :game="game" :gamePlaneScale="gamePlaneScale" />
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
      :offset="state.isMobile && state.isPortrait ? { top: 100 } : {}"
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
import { addMouseEvents, removeMouseEvents } from './gameMouseEvents.mjs';

import GUIWrapper from '@/components/gui-wrapper.vue';
import tutorial from '~/lib/helper/front/helper.vue';
import chat from '~/lib/chat/front/chat.vue';

export default {
  components: {
    GUIWrapper,
    tutorial,
    chat,
  },
  props: {},
  data() {
    return {
      showChat: false,
      unreadMessages: 0,
      showLog: false,
      showMoveControls: false,

      gamePlaneCustomStyleData: {},
      gamePlaneScale: 1,
      gamePlaneScaleMin: 0.3,
      gamePlaneScaleMax: 1,
      gamePlaneTranslateX: 0,
      gamePlaneTranslateY: 0,
      gamePlaneRotation: 0,
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
      const transform = [];
      transform.push('translate(' + this.gamePlaneTranslateX + 'px, ' + this.gamePlaneTranslateY + 'px)');
      transform.push(`rotate(${this.gamePlaneRotation}deg)`);
      return { transform: transform.join(' '), scale: this.gamePlaneScale };
    },
    game() {
      return this.getGame();
    },
    gameDataLoaded() {
      return this.game.addTime;
    },
    userData() {
      return this.state.store?.user?.[this.state.currentUser] || {};
    },
    lobby() {
      return this.state.store.lobby?.[this.state.currentLobby] || {};
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
    logs() {
      return this.game.logs || {};
    },
  },
  watch: {
    gameDataLoaded: function () {
      this.$set(this.$root.state, 'viewLoaded', true);
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
  },
  methods: {
    updatePlaneScale() {
      if (this.$el instanceof HTMLElement) {
        const { innerWidth, innerHeight } = window;

        const gamePlaneRotation = this.gamePlaneRotation;
        const gamePlaneTranslateX = this.gamePlaneTranslateX;
        const gamePlaneTranslateY = this.gamePlaneTranslateY;
        this.gamePlaneRotation = 0;
        this.gamePlaneTranslateX = 0;
        this.gamePlaneTranslateY = 0;
        const restoreGamePlaneSettings = () => {
          this.gamePlaneRotation = gamePlaneRotation;
          this.gamePlaneTranslateX = gamePlaneTranslateX;
          this.gamePlaneTranslateY = gamePlaneTranslateY;
        };

        let { width, height } = this.$el.querySelector('#gamePlane').getBoundingClientRect();
        width = width / this.gamePlaneScale;
        height = height / this.gamePlaneScale;
        const value = Math.min(innerWidth / width, innerHeight / height);
        if (value > 0) {
          this.gamePlaneScale = value * 0.75;
          if (this.gamePlaneScaleMin > value) this.gamePlaneScaleMin = value;
          if (this.gamePlaneScaleMax < value) this.gamePlaneScaleMax = value;

          this.$nextTick(() => {
            const calcFunc = this.calcGamePlaneCustomStyleData;
            if (typeof calcFunc === 'function') {
              const calcData = calcFunc({
                gamePlaneScale: this.gamePlaneScale,
                isMobile: this.state.isMobile,
              });
              this.gamePlaneCustomStyleData = calcData;

              restoreGamePlaneSettings();
            }
          });
        }
      }
    },

    zoomGamePlane(event) {
      this.gamePlaneScale += event.deltaY > 0 ? -0.1 : 0.1;
      if (this.gamePlaneScale < this.gamePlaneScaleMin) this.gamePlaneScale = this.gamePlaneScaleMin;
      if (this.gamePlaneScale > this.gamePlaneScaleMax) this.gamePlaneScale = this.gamePlaneScaleMax;
    },
    closeCardInfo() {
      this.$set(this.$root.state, 'shownCard', '');
    },
    toggleChat() {
      this.showLog = false;
      this.showMoveControls = false;
      this.showChat = !this.showChat;
    },
    async toggleLog() {
      this.showMoveControls = false;
      this.showChat = false;
      if (this.showLog) return (this.showLog = false);
      this.showLog = true;
      await api.action
        .call({ path: 'game.api.showLogs', args: [{ lastItemTime: Object.values(this.logs).pop()?.time }] })
        .then(() => {
          // если делать присвоение здесь, то будет сбрасываться tutorial-active на кнопке
          // this.showLog = true;
        })
        .catch(prettyAlert);
    },
    toggleMoveControls() {
      this.showLog = false;
      this.showChat = false;
      this.showMoveControls = !this.showMoveControls;
    },
    async callGameEnter() {
      // без этого не смогу записать gameId и playerId в context сессии
      await api.action
        .call({
          path: 'game.api.enter',
          args: [{ gameId: this.$route.params.id }],
        })
        .then(({ gameId, playerId, viewerId, serverTime }) => {
          this.gameState.gameId = gameId;
          this.gameState.sessionPlayerId = playerId;
          this.gameState.sessionViewerId = viewerId;
          this.gameState.viewerMode = viewerId ? true : false;
          this.$set(this.$root.state, 'serverTimeDiff', serverTime - Date.now());
        })
        .catch((err) => {
          this.$router.push({ path: `/` }).catch((err) => {
            console.log(err);
          });
        });

      addEvents(this);
      addMouseEvents(this);
    },
    hasUnreadMessages(count = 0) {
      this.unreadMessages = count;
    },
  },
  async created() {},
  async mounted() {
    if (this.state.currentLobby && this.state.currentUser) {
      this.callGameEnter();
    } else {
      this.$router.push({ path: `/` }).catch((err) => {
        console.log(err);
      });
    }
  },
  async beforeDestroy() {
    this.$set(this.$root.state, 'viewLoaded', false);

    removeEvents();
    removeMouseEvents();
    if (this.$root.state.store.game?.[this.gameState.gameId]) {
      delete this.$root.state.store.game[this.gameState.gameId];
    }
  },
};
</script>

<style>
#game {
  height: 100%;
  width: 100%;
}
#game.mobile-view {
  touch-action: none;
}
#game .active-event {
  cursor: pointer;
  box-shadow: inset 0 0 20px 8px yellow;
}

#gamePlane {
  position: relative;
  width: 100%;
  height: 100%;
  opacity: 1;
  transform-origin: center;
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
}
.shown-card > .img {
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  width: 100%;
  height: 100%;
}
.shown-card > .close {
  background-image: url(@/assets/close.png);
  background-color: black;
  cursor: pointer;
  position: absolute;
  top: 10px;
  right: 10px;
  width: 50px;
  height: 50px;
  border-radius: 10px;
}
.shown-card > .close:hover {
  opacity: 0.7;
}

.game-controls.tutorial-active {
  box-shadow: rgb(244, 226, 5) 0px 0px 20px 20px;
}

.gameplane-controls {
  position: absolute;
  top: 0px;
  left: 100%;
  height: 200px;
  width: 200px;
  margin-left: auto;
  padding: 5px;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-around;
  align-items: center;
}
.gameplane-controls > div {
  width: 30%;
  height: 30%;
  background-repeat: no-repeat;
  background-position: center;
  background-size: 50%;
  background-color: black;
  border-radius: 50%;
  cursor: pointer;
}
.gameplane-controls > div:hover {
  opacity: 0.5;
}
.gameplane-controls > .move-top {
  background-image: url(assets/arrow-top.png);
}
.gameplane-controls > .move-bottom {
  background-image: url(assets/arrow-bottom.png);
}
.gameplane-controls > .move-right {
  background-image: url(assets/arrow-right.png);
}
.gameplane-controls > .move-left {
  background-image: url(assets/arrow-left.png);
}
.gameplane-controls > .zoom-plus {
  background-image: url(assets/zoom+.png);
}
.gameplane-controls > .zoom-minus {
  background-image: url(assets/zoom-.png);
}
.gameplane-controls > .rotate-left {
  background-image: url(assets/rotate-left.png);
}
.gameplane-controls > .rotate-right {
  background-image: url(assets/rotate-right.png);
}
.gameplane-controls > .reset {
  background-image: url(assets/reset.png);
}
.gameplane-controls.tutorial-active {
  box-shadow: 0 0 40px 40px #f4e205;
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
}
.gui-btn.active {
  background-color: #00000055;
}
.gui-btn:hover {
  opacity: 0.7;
}
.gui-btn.chat {
  background-image: url(assets/chat.png);
}
.gui-btn.chat.unread-messages {
  border: 2px solid #0078d7;
  box-shadow: 1px 0px 20px 6px #0078d7;
}
.gui-btn.log {
  background-image: url(assets/log.png);
}
.gui-btn.move {
  background-image: url(assets/move.png);
}
.mobile-view .gui-btn.move {
  background-image: url(assets/move-mobile.png);
}
.gui-btn.tutorial-active {
  box-shadow: 0 0 20px 20px #f4e205;
}

.chat-content {
  z-index: 3;
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
}
.chat-content.visible {
  display: block;
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
  z-index: 2;
  width: calc(100% - 100px);
  height: calc(100% - 100px);
  margin: 30px;
  box-shadow: inset 0px 0px 2px 2px #f4e205;
  background-image: url(@/assets/clear-black-back.png);
  color: #f4e205;
  overflow: auto;
  text-align: left;
}
.mobile-view .log-content {
  left: 0px;
  width: calc(100% - 40px);
  margin: 20px;
}
.log-item {
  padding: 10px;
}
</style>
