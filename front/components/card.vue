<template>
  <div
    v-if="card._id || cardData"
    :name="card.name"
    :class="['card-event', card.played ? 'played' : '', this.isSelected ? 'selected' : '']"
    :style="customStyle"
    v-on:click.stop="toggleSelect"
  >
    <div class="card-info-btn" v-on:click.stop="showInfo(card.name)" />
    <div
      v-if="canPlay && sessionPlayerIsActive() && !actionsDisabled() && !card.played"
      v-on:click.stop="playCard"
      class="play-btn"
    >
      Разыграть
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
    cardData: Object,
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
      return card?._id ? card : { _id: this.cardId };
    },
    isSelected() {
      return this.cardId === this.gameCustom.selectedCard;
    },
    customStyle() {
      const style = {
        backgroundImage: `url(${this.state.lobbyOrigin}/img/cards/${this.game.deckType}/${this.card.name}.jpg), url(empty-card.jpg)`,
      };
      return style;
    },
  },
  methods: {
    async playCard() {
      if (this.card.played) return;
      await this.handleGameApi({ name: 'playCard', data: { cardId: this.cardId } });
    },
    toggleSelect() {
      this.gameCustom.selectedCard = this.isSelected ? null : this.cardId;
    },
    showInfo(name) {
      this.$set(this.$root.state, 'shownCard', name);
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
  box-shadow: inset 0px 20px 20px 0px black;
  background-image: url(../assets/back-side.jpg);
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
  width: 100px;
  font-size: 0.5em;
  border: 1px solid black;
  text-align: center;
  cursor: pointer;
  margin: 6px 10px;
  background: #3f51b5;
  color: white;
  font-size: 16px;
  padding: 8px 0px;
}
.card-event.active {
  border: 4px solid green;
}
</style>
