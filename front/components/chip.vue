<template>
  <div
    v-if="!usesStore || chip._id || chipId === 'fake'"
    :class="[
      'chip',
      customClass,
      chipId === 'fake' ? 'fake' : '',
      selectable ? 'selectable' : '',
      chip?.disabled ? 'disabled' : '',
    ]"
    :subtype="displaySubtype || undefined"
    :style="rootStyle"
    v-on:click.stop="chooseChip"
  >
    <div class="chip-face" :style="faceStyle" />
  </div>
</template>

<script>
import { inject } from 'vue';

function clampFrame(value, maxFrames) {
  const n = Number.isFinite(maxFrames) ? Math.trunc(maxFrames) : 1;
  const max = Math.max(1, n);
  const raw = Number(value);
  const v = Number.isFinite(raw) ? Math.trunc(raw) : 1;
  return Math.min(Math.max(v, 1), max);
}

export default {
  name: 'chip',
  props: {
    /** Если задан — кадр и subtype берутся из `store.chip[chipId]`. */
    chipId: {
      type: String,
      default: '',
    },
    chipData: Object,
    /** При отсутствии `chipId`: номер кадра в спрайте (1 … spriteFrameCount). */
    value: {
      type: Number,
      default: 1,
    },
    subtype: {
      type: String,
      default: '',
    },
    customClass: {
      type: [String, Array, Object],
      default: () => [],
    },
    size: {
      type: Number,
      default: 56,
    },
    spriteImageUrl: {
      type: String,
      default: '',
    },
    spriteFrameCount: {
      type: Number,
      default: 1,
    },
    onClick: {
      type: Function,
      default: null,
    },
  },
  setup() {
    return inject('gameGlobals');
  },
  computed: {
    usesStore() {
      return Boolean(this.chipId);
    },
    store() {
      return this.getStore();
    },
    player() {
      return this.sessionPlayer();
    },
    chip() {
      if (!this.chipId) return {};
      return this.store.chip?.[this.chipId] || {};
    },
    displaySubtype() {
      if (this.usesStore) return this.chip.subtype || '';
      return this.subtype;
    },
    frameIndex() {
      let v;
      if (!this.usesStore) {
        v = this.value;
      } else if (this.chipId) {
        const raw = this.chip?.value;
        const num = Number(raw);
        v = Number.isFinite(num) ? num : this.value;
      } else {
        v = this.chip?.value;
      }
      return clampFrame(v, this.spriteFrameCount);
    },
    rootStyle() {
      const s = this.size;
      return {
        width: `${s}px`,
        height: `${s}px`,
      };
    },
    faceStyle() {
      const url = this.spriteImageUrl;
      const n = Math.max(1, Math.trunc(this.spriteFrameCount) || 1);
      const frame = this.frameIndex;
      const idx = frame - 1;
      const xPct = n <= 1 ? 0 : (idx / (n - 1)) * 100;
      if (!url) {
        return {
          backgroundImage: 'none',
          backgroundColor: 'rgba(255, 255, 255, 0.12)',
        };
      }
      return {
        backgroundImage: `url(${url})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: `${n * 100}% 100%`,
        backgroundPosition: `${xPct}% 0`,
      };
    },
    selectable() {
      return this.sessionPlayerIsActive() && this.player.eventData.chip?.[this.chipId]?.selectable;
    },
  },
  methods: {
    chooseChip() {
      if (this.onClick) return this.onClick({ chipId: this.chipId, chip: this.chip });

      if (!this.selectable) return;

      this.handleGameApi({ name: 'eventTrigger', data: { eventData: { targetId: this.chipId } } });
    },
  },
};
</script>

<style lang="scss" scoped>
.chip {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chip-face {
  width: 100%;
  height: 100%;
  background-position: 0 0;
  border-radius: 16px;
}

.chip.fake {
  .chip-face {
    background-image: none !important;
  }
}
</style>
