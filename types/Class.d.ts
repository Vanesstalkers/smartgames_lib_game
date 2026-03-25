import type { StoreBaseMethods, StoreBroadcastMethods } from '../../store/types/Class';
import type { GameObjectsModule } from './objects';
import GameObjectCtor = require('./GameObject');

export interface GameCreateParams {
  gameCode: string;
  gameType: string;
  gameConfig: string;
  gameTimer?: number;
  difficulty?: any;
  templates?: any;
  maxPlayersInGame?: any;
  minPlayersToStart?: any;
  gameRoundLimit?: number;
  teamsCount?: number;
  playerCount?: number;
}

export interface GameCreateOptions {
  initPlayerWaitEvents?: boolean;
}

/**
 * Инстанс `lib.game.GameObject`. Задаём через `InstanceType<typeof …>`, а не `extends GameObject`:
 *
 * - при `interface … extends GameObject` и `import type` для модуля с `export = declare class` языковой сервис
 *   часто **не подмешивает** методы предка в список подсказок (ограничение разрешения cross-file extends);
 * - `import GameObjectCtor = require('./GameObject')` + `InstanceType<typeof GameObjectCtor>` даёт явный инстансовый тип.
 *
 * Из API корня игры выкидываем то, что уже даёт store / переопределено в `class.js` (иначе конфликт сигнатур).
 */
export type GameObjectInstance = InstanceType<typeof GameObjectCtor>;

export type GameRootGameObjectApi = Omit<
  GameObjectInstance,
  'id' | 'markNew' | 'markDelete' | 'set' | 'select' | 'game'
>;

export type GameStoreBase = Omit<StoreBaseMethods, 'create'> & {
  create(params?: GameCreateParams, options?: GameCreateOptions): Promise<this>;
};

export interface GameInstance extends GameRootGameObjectApi, GameStoreBase, StoreBroadcastMethods {
  store: Record<string, Record<string, any>>;
  playerMap: Record<string, any>;
  eventListeners: Record<string, any[]>;
  startTutorialName: string;

  /** корень: ссылка на саму игру */
  game(): GameInstance;

  set(val: Record<string, any>, config?: Record<string, any>): void;
  markNew(obj: any, config?: { saveToDB?: boolean; changes?: Record<string, any> }): void;
  markDelete(obj: any, config?: { saveToDB?: boolean }): void;
  select(query?: string | Record<string, any>): any[];

  isCoreGame(): boolean;
  addToObjectStorage(obj: any): void;
  deleteFromObjectStorage(obj: any): void;
  defaultClasses(map?: GameObjectsModule): GameObjectsModule;

  restart(): void;
  addGameToCache(): Promise<void>;
  updateGameAtCache(data?: Record<string, any>): Promise<void>;
  run(actionPath: string, data?: any, initPlayer?: any): any;

  addEventListener(data: { handler: string; event: any }): void;
  removeEventListener(data: { handler: string; eventToRemove?: any }): void;
  removeAllEventListeners(data: { sourceId?: string; event?: any }): void;
  toggleEventHandlers(handler: string, data?: any, initPlayer?: any): any[];
  forceEmitEventHandler(handler: string, data: any): void;
  clearEvents(): void;
  logs(data?: string | Record<string, any>, config?: { consoleMsg?: boolean }): Record<string, any>;
  showLogs(data: { sessionId: string; lastItemTime?: number }): Promise<void>;

  isSinglePlayer(): boolean;
  players(options?: { ai?: boolean; readyOnly?: boolean }): any[];
  getPlayerByUserId(id: string): any;
  playerJoin(data: {
    playerId?: string;
    userId: string;
    userName?: string;
    userAvatar?: string;
  }): Promise<{ playerId: string } | undefined>;
  viewerJoin(data: { viewerId?: string; userId: string; userName?: string }): Promise<void>;
  playerLeave(data: { userId: string }): Promise<void>;
  viewerLeave(data: { userId: string; viewerId: string }): Promise<void>;
  roundActivePlayer(player?: any): any;
  selectNextActivePlayer(): any;
  checkWinnerAndFinishGame(): any;
  setWinner(data: { player: any }): void;
  getFreePlayerSlot(): any;
  getActivePlayer(): any;
  getActivePlayers(): any[];
  activatePlayers(data?: { notifyUser?: boolean; setData?: any; disableSkipTurnCheck?: boolean }): void;
  checkAllPlayersFinishRound(): boolean;
  handleAction(data: { name: string; data?: any; sessionUserId: string }): Promise<void>;

  prepareBroadcastData(data: { data?: any; userId?: string; viewerMode?: boolean }): Record<string, any>;
  addBroadcastObject(data: { col: string; id: string }): void;
  deleteBroadcastObject(data: { col: string; id: string }): void;
  broadcastDataBeforeHandler(data: any, config?: any): void;
  broadcastDataAfterHandler(data: any, config?: any): void;
  broadcastDataVueStoreRuleHandler(data: any, ctx: { accessConfig: any }): any;
  getBroadcastRule(ruleHandler: string): (...args: any[]) => any;

  removeGame(options?: { preventDeleteDumps?: boolean }): Promise<void>;
  onTimerRestart(data: { data?: { time?: number; extraTime?: number } }): void;
  onTimerTick(): Promise<void>;
  onTimerDelete(): void;
  playerUseTutorial(data: { userId: string; usedLink: string }): Promise<void>;
  updateTimerOverdueCounter(timerOverdue: boolean): void;
  prepareRoundObject(obj?: Record<string, any>): any;
}

export interface GameClass {
  new (storeData?: Record<string, any>, gameObjectData?: Record<string, any>): GameInstance;
}

declare function createGameClass(): GameClass;

export = createGameClass;
