import { StoreClass, BroadcasterClass } from '../store/types';

// Базовый интерфейс для GameObject
interface GameObject {
  game: (game?: Game) => Game;
  prepareBroadcastData: (options: { data: any; player: Player; viewerMode: boolean }) => {
    visibleId: string;
    preparedData: any;
  };
}

export interface Game extends StoreClass, BroadcasterClass, GameObject {
  // Основные методы
  isCoreGame: () => boolean;

  set: (val: any, config?: any) => void;
  setChanges: (val: any, config?: any) => void;
  markNew: (obj: any, options?: any) => void;
  markDelete: (obj: any, options?: any) => void;
  addToObjectStorage: (obj: any) => void;
  deleteFromObjectStorage: (obj: any) => void;

  defaultClasses: (map?: any) => any;
  select: (query?: any) => any;

  // Методы создания и управления игрой
  create: (options?: any, config?: any) => Promise<Game>;
  restart: () => void;
  addGameToCache: () => Promise<void>;
  updateGameAtCache: (data?: any) => Promise<void>;

  // Методы для работы с данными
  processData: (data: any) => Promise<void>;

  // Методы для выполнения действий
  run: (actionPath: string, data?: any, initPlayer?: any) => any;

  // Методы для работы с событиями
  addEventListener: (options: any) => void;
  removeEventListener: (options: any) => void;
  removeAllEventListeners: (options: any) => void;
  toggleEventHandlers: (handler: string, data?: any, initPlayer?: any) => any[];
  forceEmitEventHandler: (handler: string, data?: any) => void;
  clearEvents: () => void;

  // Методы для логирования
  logs: (data?: any, options?: any) => any;
  showLogs: (options: any) => Promise<void>;

  // Методы для работы с игроками
  isSinglePlayer: () => boolean;
  players: (options?: any) => Player[];
  getPlayerByUserId: (id: string) => Player | undefined;
  playerJoin: (options: any) => Promise<void>;
  viewerJoin: (options: any) => Promise<void>;
  playerLeave: (options: any) => Promise<void>;
  viewerLeave: (options: any) => Promise<void>;

  // Методы для управления ходами
  roundActivePlayer: (player?: Player) => Player | undefined;
  selectNextActivePlayer: () => Player | undefined;
  checkWinnerAndFinishGame: () => any;
  setWinner: (options: any) => void;
  getFreePlayerSlot: () => Player | undefined;
  getActivePlayer: () => Player | undefined;
  getActivePlayers: () => Player[];
  activatePlayers: (options: any) => void;
  checkAllPlayersFinishRound: () => boolean;

  // Методы для обработки действий
  handleAction: (options: any) => Promise<void>;

  // Методы для broadcast данных
  prepareBroadcastData: (options: { data: any; player: Player; viewerMode: boolean }) => any;
  addBroadcastObject: (options: any) => void;
  deleteBroadcastObject: (options: any) => void;
  broadcastDataBeforeHandler: (data: any, config?: any) => void;
  broadcastDataAfterHandler: (data: any, config?: any) => void;
  broadcastDataVueStoreRuleHandler: (data: any, options: any) => any;

  // Методы для удаления игры
  removeGame: (options?: any) => Promise<void>;

  // Методы для работы с таймерами
  onTimerRestart: (options: any) => void;
  onTimerTick: (options: any) => Promise<void>;
  onTimerDelete: (options: any) => void;
  playerUseTutorial: (options: any) => Promise<void>;
  updateTimerOverdueCounter: (timerOverdue: boolean) => void;

  // Методы для работы с раундами
  prepareRoundObject: (obj?: any) => any;

  // Свойства
  store: any;
  playerMap: any;
  eventListeners: any;
  status?: string;
  deckType?: string;
  gameType?: string;
  gameConfig?: string;
  gameTimer?: number;
  settings?: any;
  round?: number;
  roundActivePlayerId?: string;
  winUserId?: string;
  timerOverdueCounter?: number;
  rounds?: any;
  lastRoundTimerConfig?: any;
}

export interface Player extends GameObject {
//   prepareBroadcastData: (options: { data: { test: boolean }; player: Player; viewerMode: boolean }) => {
//     visibleId: string;
//     preparedData: any;
//   };

  id: () => string;
  activate: (options?: any) => void;
  notifyUser: (message: string) => void;
  userId?: string;
  userName?: string;
  avatarCode?: string;
  ai?: boolean;
  ready?: boolean;
  active?: boolean;
  money?: number;
  eventData?: any;
  timerEndTime?: number;
  timerUpdateTime?: number;
}

export type GameModule = {
  class: new (storeData?: any, gameObjectData?: any) => Game;
  GameObject: GameObject;
  _objects: {
    Player: new (storeData?: any, gameObjectData?: any) => Player;
  };
  actions: {
    addPlayer: (data: any, test?: boolean) => Player;
    getFilledGamesConfigs: () => any;
    loadGame?: (data: any) => Promise<Game>;
  };
  flush: {
    exec: () => void;
    list: Game[];
    statsOnStart?: any;
  };
  endGameException?: any;
  events?: any;
  decorators?: any;
  GameEvent?: any;
};
