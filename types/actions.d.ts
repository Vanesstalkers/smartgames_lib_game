import type { GameInstance } from './Class';
import type { GameObjectInstance, PlayerInstance } from './objects';

/**
 * Результат `roundSteps`: домен может расширять полями `statusLabel`, `roundStep`, `timerRestart`, `forcedEndRound`.
 */
export interface RoundStepsResult {
  newRoundLogEvents: string[];
  newRoundNumber: number;
  statusLabel?: string;
  roundStep?: string | number;
  /** `true` — взять `lastRoundTimerConfig`; иначе объект конфига таймера */
  timerRestart?: boolean | Record<string, any>;
  /** если true, `roundStart` сразу вызывает `roundEnd` */
  forcedEndRound?: boolean;
}

/**
 * Вход `lib.game.actions.broadcastRules.lobbySub` — снимок игры для подписки лобби (см. README лобби).
 */
export interface LobbySubBroadcastPayload {
  round?: number;
  status?: string;
  gameCode?: string;
  gameType?: string;
  gameConfig?: string;
  gameTimer?: number;
  playerMap?: Record<string, unknown>;
  maxPlayersInGame?: number;
  minPlayersToStart?: number;
  store?: { player?: Record<string, { ready?: boolean } | null> };
  [key: string]: any;
}

export interface GameActionsBroadcastRules {
  lobbySub(data: LobbySubBroadcastPayload): Record<string, any>;
}

/**
 * Рантайм: `lib.game.actions.*` — функции действий; часть вызывается через `game.run(name)` с привязкой `this` к игре.
 * Домен может подмешивать свои поля (см. `[key: string]`).
 */
export interface GameActionsModule {
  /** Сводка конфигов игр по типам (items + defaults) для лобби и сервера */
  getFilledGamesConfigs(): Record<string, any>;

  /** Восстановление игры из дампа и публикация в лобби (опционально подменяется в `domain.game.actions`) */
  loadGame?(opts: {
    gameType: string;
    gameId: string;
    lobbyId?: string;
    query?: Record<string, any>;
  }): Promise<GameInstance>;

  /** Правила отбора полей при рассылке в канал лобби */
  broadcastRules: GameActionsBroadcastRules;

  startGame(this: GameInstance): void;
  roundStart(this: GameInstance, opts?: { preventDumpState?: boolean; preventNotifyUser?: boolean }): void;
  roundEnd(this: GameInstance, opts?: { timerOverdue?: boolean }): void;
  roundSteps(this: GameInstance): RoundStepsResult;
  takeCard(this: GameInstance, data: { count: number }): void;
  playCard(
    this: GameInstance,
    data: { cardId: string; targetPlayerId?: string },
    player: PlayerInstance | GameObjectInstance
  ): void;
  addPlayer(this: GameInstance, data: Record<string, any>): GameObjectInstance;
  endGame(
    this: GameInstance,
    opts?: {
      winningPlayer?: GameObjectInstance;
      canceledByUser?: string | boolean;
      customFinalize?: boolean;
      msg?: unknown;
    }
  ): void;
  getGameAward(this: GameInstance): number;
  eventTrigger(this: GameInstance, data?: { eventData?: Record<string, any> }, initPlayer?: GameObjectInstance): void;
  eventReset(this: GameInstance, data?: { eventData?: Record<string, any> }, initPlayer?: GameObjectInstance): void;
  initPlayerWaitEvents(this: GameInstance): void;
  initGameProcessEvents(this: GameInstance): unknown;

  [key: string]: any;
}
