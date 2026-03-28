<template>
  <div
    v-if="dicecube._id"
    class="dicecube"
    :class="{ 'dicecube--rolling': isRolling }"
    :subtype="dicecube.subtype"
    :style="rootStyle"
  >
    <div class="dicecube-face" :style="faceStyle" />
  </div>
</template>

<script>
import { inject } from 'vue';

import dicesSprite from '../assets/dices.png';

/** У игрового кубика только value 1–6; в спрайте кадры 1–6 (очки). */
const SPRITE_FRAMES = 8;
const VALUE_MIN = 1;
const VALUE_MAX = 6;
const ROLL_DURATION_MS = 1000;
const ROLL_TICK_MS = 55;

function clampDiceValue(v) {
  const n = Number.isFinite(v) ? Math.trunc(v) : VALUE_MIN;
  return Math.min(Math.max(n, VALUE_MIN), VALUE_MAX);
}

export default {
  name: 'dicecube',
  props: {
    dicecubeId: String,
    diceData: Object,
    size: {
      type: Number,
      default: 56,
    },
  },
  data() {
    return {
      displayValue: VALUE_MIN,
      isRolling: false,
      rollIntervalId: null,
      /** учёт в gameCustom.diceRollActiveCount для пары start/stop одного броска */
      rollDepthApplied: false,
    };
  },
  setup() {
    return inject('gameGlobals');
  },
  computed: {
    store() {
      return this.getStore();
    },
    dicecube() {
      return this.store.dicecube?.[this.dicecubeId] || {};
    },
    targetValue() {
      return clampDiceValue(this.dicecube?.value);
    },
    lastRollTime() {
      const t = this.dicecube?.lastRollTime;
      return typeof t === 'number' && Number.isFinite(t) ? t : null;
    },
    rootStyle() {
      const s = this.size;
      return {
        width: `${s}px`,
        height: `${s}px`,
      };
    },
    faceStyle() {
      const face = clampDiceValue(this.displayValue);
      const xPct = SPRITE_FRAMES > 1 ? (face / (SPRITE_FRAMES - 1)) * 100 : 0;
      return {
        backgroundImage: `url(${dicesSprite})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: `${SPRITE_FRAMES * 100}% 100%`,
        backgroundPosition: `${xPct}% 0`,
      };
    },
  },
  watch: {
    lastRollTime: {
      handler(newTime, oldTime) {
        // immediate: первая отдача — без анимации (в т.ч. визор после загрузки)
        if (oldTime === undefined) {
          this.displayValue = this.targetValue;
          return;
        }
        if (newTime == null || newTime === oldTime) return;
        this.startRollAnimation(this.targetValue);
      },
      immediate: true,
    },
    dicecubeId() {
      this.stopRollAnimation();
      this.displayValue = this.targetValue;
    },
  },
  beforeDestroy() {
    this.stopRollAnimation();
  },
  beforeUnmount() {
    this.stopRollAnimation();
  },
  methods: {
    releaseDiceRollDepth() {
      if (!this.rollDepthApplied) return;
      this.rollDepthApplied = false;
      const g = this.gameCustom;
      if (!g) return;
      g.diceRollActiveCount = Math.max(0, (g.diceRollActiveCount || 0) - 1);
      if (g.diceRollActiveCount === 0) {
        g.diceRollSettledSeq = (g.diceRollSettledSeq || 0) + 1;
      }
    },
    stopRollAnimation() {
      if (this.rollIntervalId != null) {
        clearInterval(this.rollIntervalId);
        this.rollIntervalId = null;
      }
      if (this.isRolling) {
        this.releaseDiceRollDepth();
      }
      this.isRolling = false;
    },
    startRollAnimation(finalValue) {
      this.stopRollAnimation();
      this.isRolling = true;
      this.rollDepthApplied = true;
      const g = this.gameCustom;
      if (g) g.diceRollActiveCount = (g.diceRollActiveCount || 0) + 1;

      const target = clampDiceValue(finalValue);
      const start = Date.now();

      this.rollIntervalId = setInterval(() => {
        const elapsed = Date.now() - start;
        if (elapsed >= ROLL_DURATION_MS) {
          if (this.rollIntervalId != null) {
            clearInterval(this.rollIntervalId);
            this.rollIntervalId = null;
          }
          this.displayValue = target;
          this.releaseDiceRollDepth();
          this.isRolling = false;
          return;
        }
        this.displayValue = VALUE_MIN + Math.floor(Math.random() * VALUE_MAX);
      }, ROLL_TICK_MS);
    },
  },
};
</script>

<style lang="scss" scoped>
.dicecube {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;

  &--rolling .dicecube-face {
    animation: dicecube-roll-nudge 90ms ease-in-out infinite alternate;
    filter: brightness(1.05);
  }
}

@keyframes dicecube-roll-nudge {
  from {
    transform: rotate(-2deg) scale(1);
  }
  to {
    transform: rotate(2deg) scale(1.04);
  }
}

.dicecube-face {
  width: 100%;
  height: 100%;
  border-radius: 10px;
  pointer-events: none;
}
</style>
