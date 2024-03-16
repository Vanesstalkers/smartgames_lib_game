<template>
  <div
    v-if="card._id || cardData"
    :name="card.name"
    :class="[
      'card-event',
      card.played ? 'played' : '',
      this.isSelected ? 'selected' : '',
      selectable ? 'selectable' : '',
      card.eventData.cardClass || '',
      card.eventData.playDisabled ? 'play-disabled' : '',
    ]"
    :style="customStyle"
    v-on:click.stop="toggleSelect"
  >
    <div v-if="card.name" class="card-info-btn" v-on:click.stop="showInfo(card.name)" />
    <div v-if="canPlay && !card.eventData.playDisabled" v-on:click.stop="playCard" class="play-btn">
      {{ card.eventData.buttonText || 'Разыграть' }}
    </div>
  </div>
</template>

<script>
import { inject } from 'vue';

export default {
  name: 'card',
  props: {
    cardId: String,
    canPlay: Boolean,
    playerActive: {
      type: Boolean,
      default: true,
    },
    cardData: Object,
    cardGroup: String,
    imgExt: String,
    imgFullPath: String, // формат: `${this.state.serverOrigin}/img/cards/${this.card.name}.jpg`
  },
  data() {
    return {};
  },
  setup() {
    return inject('gameGlobals');
  },
  computed: {
    state() {
      return this.$root.state || {};
    },
    store() {
      return this.getStore();
    },
    game() {
      return this.getGame();
    },
    card() {
      if (this.cardData) return this.cardData;
      const card = this.store.card?.[this.cardId];
      return card?._id ? card : { _id: this.cardId, eventData: {} };
    },
    hasActiveEvent() {
      return this.sessionPlayerIsActive() && this.card.eventData.activeEvents?.length;
    },
    selectable() {
      return this.sessionPlayerIsActive() && this.card.eventData.selectable?.length;
    },
    isSelected() {
      return this.cardId === this.gameCustom.selectedCard;
    },
    customStyle() {
      const {
        state: { serverOrigin },
        card,
        game,
        imgFullPath,
        imgExt = 'jpg',
      } = this;

      const rootPath = `${serverOrigin}/img/cards`;
      const { group, name } = card;

      const cardPath = [this.cardGroup || group, name || 'back-side'].join('/');
      const path = imgFullPath || `${rootPath}/${cardPath}.${imgExt}` || `empty-card.${imgExt}`;

      return {
        backgroundImage: `url(${path})`,
      };
    },
  },
  methods: {
    async playCard() {
      if (this.card.played) return;
      await this.handleGameApi({
        name: 'playCard',
        data: {
          cardId: this.cardId,
          targetPlayerId: this.$parent.playerId,
        },
      });
    },
    toggleSelect() {
      this.gameCustom.selectedCard = this.isSelected ? null : this.cardId;
    },
    showInfo(name) {
      this.$set(this.$root.state, 'shownCard', this.customStyle);
    },
  },
  mounted() {},
};
</script>

<style lang="scss">
.card-event {
  position: relative;
  border: 1px solid;
  width: 120px;
  height: 180px;
  background-size: cover;
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  border-radius: 10px;
  margin: 0px 0px 0px 5px;
  background-color: grey;

  &.tutorial-active {
    box-shadow: 0 0 10px 10px #f4e205 !important;
  }
}
.card-event.selected {
  z-index: 1;
  box-shadow: 0px 100px 100px 0px black;
}
.card-info-btn {
  position: absolute;
  right: 10px;
  top: 10px;
  width: 30px;
  height: 30px;
  background-image: url(@/assets/info.png);
  background-size: contain;
  cursor: pointer;
  visibility: hidden;
}
.card-info-btn:hover {
  opacity: 0.7;
}
.card-event:hover > .card-info-btn,
#game.mobile-view .card-event.selected > .card-info-btn {
  visibility: visible;
}
.card-event.played {
  filter: grayscale(1);
}
.play-btn {
  cursor: pointer;
  position: absolute;
  bottom: 0px;
  font-size: 0.5em;
  border: 1px solid black;
  text-align: center;
  cursor: pointer;
  background: #3f51b5de;
  color: white;
  font-size: 16px;
  padding: 8px 0px;
  width: 100%;
  margin: 0px;
  border-bottom-left-radius: 4px;
  border-bottom-right-radius: 4px;

  &:hover {
    background: #3f51b5;
  }
}

.card-event.active {
  border: 4px solid green;
}

.card-event.selectable.highlight-off,
.card-event.selectable.play-disabled {
  box-shadow: none !important;
}
.card-event.selectable {
  box-shadow: inset 0 0 20px 8px lightgreen !important;
}

.card-event.alert {
  box-shadow: inset 0 0 10px 4px #b53f3f !important;

  .play-btn {
    background: #b53f3fde;

    &:hover {
      background: #b53f3f;
    }
  }
}
.card-event.danger {
  box-shadow: inset 0 0 10px 4px #b53f3f !important;

  .play-btn {
    background: #b53f3fde;

    &:hover {
      background: #b53f3f;
    }
  }
}

//
</style>
