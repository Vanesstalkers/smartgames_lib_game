<template>
  <div
    v-if="roulette._id"
    class="roulette"
    :class="{ 'roulette--spinning': isSpinning, 'roulette--arrow': isArrowIndicator }"
    :subtype="roulette.subtype"
    :style="rootStyle"
  >
    <div class="roulette-wheel-host" :style="wheelHostStyle">
      <div class="roulette-wheel" :style="wheelStyleCombined" />
      <img
        v-if="isArrowIndicator"
        class="roulette-arrow"
        :src="arrowImageResolved"
        alt=""
        draggable="false"
        :style="arrowStyle"
      />
      <div v-else class="roulette-ball" :style="ballStyle" />
      <div
        v-if="hasStopSlot"
        v-show="stopSlotUiVisible"
        class="roulette-stop-anchor"
        :style="stopAnchorStyle"
      >
        <slot
          name="stop"
          :sector-index="displaySector"
          :sector-key="displaySectorKeyText"
          :sector-angle-deg="displaySectorAngleDeg"
          :sectors-list="sectorsList"
          :is-spinning="isSpinning"
        />
      </div>
    </div>
    <div v-if="showSectorKey" class="roulette-sector-key">{{ displaySectorKeyText }}</div>
  </div>
</template>

<script>
import { inject } from 'vue';

import rouletteWheel from '../assets/roulette.png';
import rouletteArrow from '../assets/roulette-arrow.png';

/** Fallback, если в store ещё нет `sectors` (должно совпадать по длине с дефолтом на сервере). */
const FALLBACK_SECTOR_KEYS = Array.from({ length: 37 }, (_, i) => String(i));

const WHEEL_TRANSITION = 'transform 0.85s ease-out';
const SPIN_DURATION_MS = 1000;
const SPIN_TICK_MS = 55;
/** Пауза после остановки спина, прежде чем снова показать слот `stop`. */
const STOP_SLOT_SHOW_DELAY_MS = 1000;
const BALL_RADIUS_RATIO = 0.38;
/** Ширина стрелки относительно стороны квадрата рулетки (pivot по центру ассета). */
const ARROW_WIDTH_RATIO = 0.92;

function clampSectorIndex(idx, count) {
  const n = Number.isFinite(idx) ? Math.trunc(idx) : 0;
  const max = Math.max(0, count - 1);
  return Math.min(Math.max(n, 0), max);
}

export default {
  name: 'roulette',
  props: {
    rouletteId: String,
    rouletteData: Object,
    /** URL картинки колеса (из import или абсолютный путь); если не задан — lib/assets/roulette.png */
    wheelImageUrl: {
      type: String,
      default: '',
    },
    /** Дополнительные стили для `.roulette-wheel` (объединяются с внутренними; при совпадении ключей приоритет у этого объекта). */
    wheelExtraStyle: {
      type: Object,
      default: () => ({}),
    },
    /** `ball` — крутится колесо + шарик по ободу; `arrow` — колесо статично, вращается только стрелка (`roulette-arrow.png`). */
    indicatorMode: {
      type: String,
      default: 'ball',
      validator: (v) => v === 'ball' || v === 'arrow',
    },
    /** URL стрелки при `indicatorMode === 'arrow'`; по умолчанию lib/assets/roulette-arrow.png */
    arrowImageUrl: {
      type: String,
      default: '',
    },
    /** Показывать под колесом текстовый ключ текущего сектора (`sectorsList[displaySector]`). */
    showSectorKey: {
      type: Boolean,
      default: true,
    },
    /**
     * Радиус точки «стопа» для слота `stop` как доля от `size` (как у шарика — на ободе).
     * Совпадает с `BALL_RADIUS_RATIO`, если не задано иное.
     */
    stopRadiusRatio: {
      type: Number,
      default: BALL_RADIUS_RATIO,
    },
    /**
     * Дополнительный сдвиг якоря слота `stop` от центра, в долях `size` (наружу от обода).
     * Чтобы плашка целиком оказалась снаружи круга колеса.
     */
    stopOutwardOffsetRatio: {
      type: Number,
      default: 0,
    },
    /**
     * Симметричный «запас» вокруг колеса (px): увеличивает корневой блок и даёт padding,
     * чтобы содержимое слота `stop`, выпирающее за квадрат колеса, не обрезалось предками.
     */
    stopSlotGutterPx: {
      type: Number,
      default: 0,
    },
    size: {
      type: Number,
      default: 400,
    },
  },
  data() {
    return {
      displaySector: 0,
      isSpinning: false,
      spinIntervalId: null,
      rollDepthApplied: false,
      /** Слот `stop`: видим после спина и с задержкой `STOP_SLOT_SHOW_DELAY_MS`. */
      stopSlotUiVisible: true,
      stopSlotRevealTimeoutId: null,
    };
  },
  setup() {
    return inject('gameGlobals');
  },
  computed: {
    store() {
      return this.getStore();
    },
    roulette() {
      return this.store.roulette?.[this.rouletteId] || {};
    },
    /** Ключи секторов по кругу (как `Roulette.sectors` с сервера). */
    sectorsList() {
      const s = this.roulette?.sectors;
      if (Array.isArray(s) && s.length) return s.map((k) => (k == null ? '' : String(k)));
      return FALLBACK_SECTOR_KEYS;
    },
    sectorCount() {
      return Math.max(1, this.sectorsList.length);
    },
    /** Индекс текущего выпавшего сектора для угла колеса и шарика. */
    targetSectorIndex() {
      const v = this.roulette?.value;
      if (v == null) return 0;
      const key = String(v);
      const idx = this.sectorsList.indexOf(key);
      return idx >= 0 ? idx : 0;
    },
    lastRollTime() {
      const t = this.roulette?.lastRollTime;
      return typeof t === 'number' && Number.isFinite(t) ? t : null;
    },
    isArrowIndicator() {
      return this.indicatorMode === 'arrow';
    },
    rootStyle() {
      const s = this.size;
      const g = Math.max(0, this.stopSlotGutterPx || 0);
      return {
        width: `${s + 2 * g}px`,
        boxSizing: 'border-box',
        padding: `${g}px`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        overflow: 'visible',
      };
    },
    wheelHostStyle() {
      const s = this.size;
      return {
        width: `${s}px`,
        height: `${s}px`,
        flexShrink: 0,
        overflow: 'visible',
      };
    },
    /** Ключ сектора, который сейчас соответствует углу (в т.ч. во время анимации). */
    displaySectorKeyText() {
      const list = this.sectorsList;
      const n = list.length;
      if (!n) return '—';
      const i = clampSectorIndex(this.displaySector, n);
      const key = list[i];
      return key != null && String(key).length ? String(key) : '—';
    },
    displaySectorAngleDeg() {
      return (this.displaySector / this.sectorCount) * 360;
    },
    ballRadiusPx() {
      return this.size * BALL_RADIUS_RATIO;
    },
    wheelImageResolved() {
      return this.wheelImageUrl || rouletteWheel;
    },
    arrowImageResolved() {
      return this.arrowImageUrl || rouletteArrow;
    },
    wheelStyle() {
      if (this.isArrowIndicator) {
        return {
          backgroundImage: `url(${this.wheelImageResolved})`,
          transform: 'none',
          transition: 'none',
        };
      }
      const deg = -this.displaySectorAngleDeg;
      return {
        backgroundImage: `url(${this.wheelImageResolved})`,
        transform: `rotate(${deg}deg)`,
        transition: this.isSpinning ? 'none' : WHEEL_TRANSITION,
      };
    },
    wheelStyleCombined() {
      return [this.wheelStyle, this.wheelExtraStyle || {}];
    },
    ballStyle() {
      const theta = this.displaySectorAngleDeg;
      const r = this.ballRadiusPx;
      return {
        transform: `translate(-50%, -50%) rotate(${theta}deg) translate(0, ${-r}px)`,
        transition: this.isSpinning ? 'none' : WHEEL_TRANSITION,
      };
    },
    /**
     * Ассет смотрит вправо (0°); сектор 0 совпадает с шариком при theta=0 (вверх) → сдвиг −90°.
     */
    arrowStyle() {
      const theta = this.displaySectorAngleDeg;
      const deg = theta - 90;
      const w = this.size * ARROW_WIDTH_RATIO;
      return {
        width: `${w}px`,
        height: 'auto',
        transform: `translate(-50%, -50%) rotate(${deg}deg)`,
        transition: this.isSpinning ? 'none' : WHEEL_TRANSITION,
      };
    },
    /** Слот `stop`: есть ли переданное содержимое (Vue 2: scoped и обычный именованный слот). */
    hasStopSlot() {
      const ss = this.$scopedSlots && this.$scopedSlots.stop;
      const s = this.$slots && this.$slots.stop;
      return Boolean(ss || s);
    },
    /** Та же привязка к сектору, что у шарика: центр → поворот на сектор → сдвиг на обод (+ наружу). */
    stopAnchorStyle() {
      const theta = this.displaySectorAngleDeg;
      const r = this.size * this.stopRadiusRatio + this.size * (this.stopOutwardOffsetRatio || 0);
      return {
        transform: `translate(-50%, -50%) rotate(${theta}deg) translate(0, ${-r}px)`,
        transition: this.isSpinning ? 'none' : WHEEL_TRANSITION,
      };
    },
  },
  watch: {
    isSpinning(newVal, oldVal) {
      this.clearStopSlotRevealTimeout();
      if (newVal) {
        this.stopSlotUiVisible = false;
        return;
      }
      if (oldVal) {
        this.stopSlotRevealTimeoutId = setTimeout(() => {
          this.stopSlotRevealTimeoutId = null;
          this.stopSlotUiVisible = true;
        }, STOP_SLOT_SHOW_DELAY_MS);
      } else {
        this.stopSlotUiVisible = true;
      }
    },
    lastRollTime: {
      handler(newTime, oldTime) {
        if (oldTime === undefined) {
          this.displaySector = this.targetSectorIndex;
          return;
        }
        if (newTime == null || newTime === oldTime) return;
        this.startSpinAnimation(this.targetSectorIndex);
      },
      immediate: true,
    },
    rouletteId() {
      this.stopSpinAnimation();
      this.displaySector = this.targetSectorIndex;
    },
  },
  beforeDestroy() {
    this.clearStopSlotRevealTimeout();
    this.stopSpinAnimation();
  },
  beforeUnmount() {
    this.clearStopSlotRevealTimeout();
    this.stopSpinAnimation();
  },
  methods: {
    clearStopSlotRevealTimeout() {
      if (this.stopSlotRevealTimeoutId != null) {
        clearTimeout(this.stopSlotRevealTimeoutId);
        this.stopSlotRevealTimeoutId = null;
      }
    },
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
    stopSpinAnimation() {
      if (this.spinIntervalId != null) {
        clearInterval(this.spinIntervalId);
        this.spinIntervalId = null;
      }
      if (this.isSpinning) {
        this.releaseDiceRollDepth();
      }
      this.isSpinning = false;
    },
    startSpinAnimation(finalIndex) {
      this.stopSpinAnimation();
      this.isSpinning = true;
      this.rollDepthApplied = true;
      const g = this.gameCustom;
      if (g) g.diceRollActiveCount = (g.diceRollActiveCount || 0) + 1;

      const count = this.sectorCount;
      const target = clampSectorIndex(finalIndex, count);
      const start = Date.now();

      this.spinIntervalId = setInterval(() => {
        const elapsed = Date.now() - start;
        if (elapsed >= SPIN_DURATION_MS) {
          if (this.spinIntervalId != null) {
            clearInterval(this.spinIntervalId);
            this.spinIntervalId = null;
          }
          this.displaySector = target;
          this.releaseDiceRollDepth();
          this.isSpinning = false;
          return;
        }
        this.displaySector = Math.floor(Math.random() * count);
      }, SPIN_TICK_MS);
    },
  },
};
</script>

<style lang="scss" scoped>
.roulette {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 2;
  overflow: visible;

  &--spinning .roulette-wheel {
    filter: brightness(1.04);
  }

  &--spinning.roulette--arrow .roulette-wheel {
    filter: none;
  }
}

.roulette-wheel-host {
  position: relative;
}

.roulette-sector-key {
  margin-top: 6px;
  width: 100%;
  text-align: center;
  font-size: 13px;
  line-height: 1.2;
  color: rgba(255, 255, 255, 0.92);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.75);
  word-break: break-word;
}

.roulette-wheel {
  position: relative;
  z-index: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.roulette-arrow {
  position: absolute;
  left: 50%;
  top: 50%;
  display: block;
  object-fit: contain;
  transform-origin: center center;
  z-index: 1;
  user-select: none;
}

.roulette-ball {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #ffffff, #e8e8e8 55%, #c8c8c8);
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.4),
    inset 0 1px 1px rgba(255, 255, 255, 0.9);
  z-index: 1;
}

.roulette-stop-anchor {
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  transform-origin: center center;
}
</style>
