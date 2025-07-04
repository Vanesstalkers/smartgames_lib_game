<template>
  <div v-if="gameDataLoaded" id="game" :type="game.gameType" :config="game.gameConfig" :class="[
    debug ? 'debug' : '',
    state.isMobile ? 'mobile-view' : '',
    state.isLandscape ? 'landscape-view' : 'portrait-view',
    gameState.viewerMode ? 'viewer-mode' : '',
  ]" @wheel.prevent="zoomGamePlane">
    <slot name="helper-guru">
      <tutorial :game="game" class="scroll-off" :defaultMenu="{
        text: `Чем могу помочь, ${userData.name || userData.login}?`,
        bigControls: true,
        buttons: [
          { text: 'Спасибо, ничего не нужно', action: 'exit', exit: true },
        ],
      }" />
    </slot>

    <GUIWrapper :pos="['top', 'left']"
      :offset="{ top: 20, left: state.isMobile ? 60 : [60, 80, 110, 130, 160, 190][state.guiScale] }"
      :contentClass="['gui-small']" :wrapperStyle="{ zIndex: 1 }">
      <div class="game-controls" style="display: flex">
        <div :class="['chat', 'gui-btn', showChat ? 'active' : '', unreadMessages ? 'unread-messages' : '']"
          v-on:click="toggleChat" />
        <div :class="['log', 'gui-btn', showLog ? 'active' : '']" v-on:click="toggleLog" />
        <div :class="['move', 'gui-btn']" v-on:click="
          resetPlanePosition();
        resetMouseEventsConfig();
        updatePlaneScale();
        " />
      </div>
    </GUIWrapper>

    <div :class="['chat-content', 'scroll-off', showChat ? 'visible' : '']">
      <slot name="chat" :isVisible="showChat" :hasUnreadMessages="hasUnreadMessages">
        <chat :defActiveChannel="`game-${gameState.gameId}`" :userData="userData" :isVisible="showChat"
          :hasUnreadMessages="hasUnreadMessages" :channels="chatChannels" />
      </slot>
    </div>

    <div v-if="showLog" class="log-content scroll-off">
      <div v-for="[id, logItem] in logItems()" :key="id" class="log-item">
        <span class="time">[ {{ new Date(logItem.time).toTimeString().split(' ')[0] }} ]</span> ::
        <span v-html="logItem.msg" />
      </div>
    </div>

    <div v-if="state.shownCard" class="shown-card scroll-off" v-on:click.stop="closeCardInfo">
      <div class="close" v-on:click.stop="closeCardInfo" />
      <div class="img" :style="state.shownCard" />
    </div>

    <div id="gamePlane" :style="{
      ...gamePlaneCustomStyleData, // например, центровка по координатам блоков в release
      ...gamePlaneControlStyle, // mouse-events + принудительный сдвиг (например, для корпоративных игр)
    }">
      <slot name="gameplane" :gamePlaneScale="gamePlaneScale" />
    </div>

    <GUIWrapper id="gameInfo" :pos="['top', 'right']" :offset="{}">
      <slot name="gameinfo" />
    </GUIWrapper>

    <GUIWrapper class="session-player" :pos="['bottom', 'right']">
      <slot name="player" />
    </GUIWrapper>
    <GUIWrapper class="players" :pos="state.isMobile && state.isPortrait ? ['top', 'right'] : ['bottom', 'left']"
      :offset="state.isMobile && state.isPortrait ? { top: 200 } : {}" :contentClass="['gui-small']">
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

export default {
  components: {
    GUIWrapper,
    tutorial,
    chat,
  },
  props: {
    planeScaleMin: Number,
    planeScaleMax: Number,
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
      gamePlaneScaleMin: this.planeScaleMin || 0.3,
      gamePlaneScaleMax: this.planeScaleMax || 1.0,
      planeScaleNeedUpdated: 0,
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
  },
  watch: {
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
      setTimeout(() => {
        this.updatePlaneScale();
      }, 100);
    },
  },
  methods: {
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

        let { width, height } = this.$el.querySelector('#gamePlane').getBoundingClientRect();
        width = width / this.gamePlaneScale;
        height = height / this.gamePlaneScale;
        const value = Math.min(innerWidth / width, innerHeight / height);
        if (value > 0) {
          this.gamePlaneScale = value * 0.75;
          if (isMobile) this.gamePlaneScale *= 0.7;
          if (this.gamePlaneScaleMin > value && value > 0.2) this.gamePlaneScaleMin = value;
          if (this.gamePlaneScale < this.gamePlaneScaleMin) this.gamePlaneScale = this.gamePlaneScaleMin;
          if (this.gamePlaneScale > this.gamePlaneScaleMax) this.gamePlaneScale = this.gamePlaneScaleMax;

          this.gamePlaneCustomStyleData = {}; // сбрасываем сдвиги gamePlane, т.к. в calcFunc используется getBoundingClientRect()
          this.$nextTick(function () {
            const calcFunc = this.calcGamePlaneCustomStyleData;
            if (typeof calcFunc === 'function') {
              const calcFuncResult = calcFunc.call(this, {
                gamePlaneScale: this.gamePlaneScale,
                isMobile,
              });

              if (calcFuncResult) {
                // const { gamePlaneTransformOrigin,  ...calcData } = calcFuncResult;
                // this.gamePlaneCustomStyleData = calcData;
                // this.gamePlaneTransformOrigin = gamePlaneTransformOrigin; // позволяет вращать gp-content
                this.gamePlaneCustomStyleData = calcFuncResult;
              }

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
        .then(async ({ gameId, playerId, viewerId, serverTime, restorationMode }) => {
          const viewerMode = viewerId ? true : false;
          this.gameState.gameId = gameId;
          this.gameState.sessionPlayerId = playerId;
          this.gameState.sessionViewerId = viewerId;
          this.gameState.viewerMode = viewerMode;
          this.$set(this.$root.state, 'serverTimeDiff', serverTime - Date.now());

          addEvents(this);
          this.addMouseEvents(this);
        })
        .catch((err) => {
          this.$router.push({ path: `/` }).catch((err) => {
            console.log(err);
          });
        });
    },
    hasUnreadMessages(count = 0) {
      this.unreadMessages = count;
    },
  },
  async created() { },
  async mounted() {
    this.$on('resetPlanePosition', this.resetPlanePosition);

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

  >.img {
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
    width: 100%;
    height: 100%;
  }

  >.close {
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
  z-index: 2;
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
</style>
