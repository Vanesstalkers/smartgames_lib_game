import GameObjectCtor = require('./GameObject');

/** Инстанс `lib.game.GameObject` (аналог наследования в рантайме) */
export type GameObjectInstance = InstanceType<typeof GameObjectCtor>;

/**
 * Инстанс `Deck` после `new Deck(data, { parent })`.
 * Явно объединён с `GameObjectInstance`, чтобы IDE показывала и базовые методы `GameObject`, и методы колоды.
 */
export type DeckInstance = GameObjectInstance & {
  itemMap: Record<string, any>;
  prepareBroadcastData(data: {
    data: Record<string, any>;
    player?: GameObjectInstance;
    viewerMode?: boolean;
  }): { visibleId: string; preparedData: Record<string, any> };
  broadcastDataAfterHandler(): void;
  customObjectCode(
    ctx: { codeTemplate: string; replacementFragment: string },
    data: { type?: string; subtype?: string; [key: string]: any }
  ): string;
  setItemClass(itemClass: any): void;
  getItemClass(): any;
  itemsCount(): number;
  addItem(item: any): any;
  removeItem(itemToRemove: GameObjectInstance): void;
  removeAllItems(): void;
  setItemVisible(item: GameObjectInstance): void;
  markItemUpdated(data: { item: GameObjectInstance; action?: string }): void;
  moveAllItems(data: Record<string, any>): void;
  moveRandomItems(data: { count: number; target: GameObjectInstance; setData?: any }): GameObjectInstance[];
  items(): GameObjectInstance[];
  getFirstItem(): GameObjectInstance | undefined;
  getRandomItem(opts?: { skipArray?: string[] }): GameObjectInstance | undefined;
  updateAllItems(updateData: Record<string, any>): void;
};

export type DeckConstructor = new (data: any, options: { parent: GameObjectInstance }) => DeckInstance;

/**
 * Инстанс `Card` после `new Card(data, { parent })`.
 */
export type CardInstance = GameObjectInstance & {
  title?: string;
  name?: string;
  event?: { name?: string; [key: string]: any };
  subtype?: string;
  playOneTime?: boolean;
  played?: number | null;
  disabled?: boolean;
  sourceDeckId?: string;
  visible?: boolean | null;
  group?: string;
  owner?: string;

  getTitle(): string;
  moveToDeck(data?: { setData?: Record<string, any> }): void;
  moveToDrop(data?: { setData?: Record<string, any> }): void;
  moveToTarget(
    target: GameObjectInstance,
    opts?: { markDelete?: boolean; setData?: Record<string, any>; setVisible?: boolean }
  ): any;
  getEvent(eventName?: string): (() => any) | null;
  restoreAvailable(): boolean;
  play(data?: { player: GameObjectInstance; logMsg?: string }): void;
  returnToHand(data: { player: GameObjectInstance & { decks?: Record<string, DeckInstance> } }): void;
};

export type CardConstructor = new (data: any, options: { parent: GameObjectInstance }) => CardInstance;

/** Миксин `lib.game.decorators['@hasDeck'].decorate()` у игрока */
export type PlayerHasDeckApi = {
  addDeck(
    data: Record<string, any>,
    options?: {
      deckMapName?: string;
      deckClass?: DeckConstructor;
      deckItemClass?: CardConstructor;
      parentDirectLink?: boolean;
    }
  ): DeckInstance;
  deleteDeck(deckToDelete: DeckInstance): void;
  decks?: Record<string, DeckInstance>;
};

/**
 * Инстанс `Player` после `new Player(data, { parent })`.
 */
export type PlayerInstance = GameObjectInstance &
  PlayerHasDeckApi & {
    gameId?: string;
    userId?: string;
    userName?: string;
    avatarCode?: string;
    avatarsMap?: Record<string, any>;
    ready?: boolean;
    active?: boolean;
    timerEndTime?: number;
    timerUpdateTime?: number;
    ai?: boolean;
    aiActions?: unknown[];
    deckMap?: Record<string, any>;
    staticHelper?: unknown;

    game(game?: GameObjectInstance): GameObjectInstance;
    prepareBroadcastData(data: {
      data: Record<string, any>;
      player?: GameObjectInstance;
    }): { preparedData: Record<string, any>; visibleId: string };
    nextPlayer(): PlayerInstance;
    prevPlayer(): PlayerInstance;
    returnTableCardsToHand(): void;
    triggerEventEnabled(data?: { ignoreEvents?: string[] }): any;
    activate(data?: { setData?: Record<string, any>; notifyUser?: any }): void;
    deactivate(data?: { setData?: Record<string, any>; notifyUser?: any }): void;
    updateUser(data?: Record<string, any>): Promise<void>;
    notifyUser(data?: string | Record<string, any>, config?: Record<string, any>): void;
    setEventWithTriggerListener(event: any): void;
    removeEventWithTriggerListener(): void;
    handleEventWithTriggerListener(handler: string, data?: Record<string, any>): any;
  };

export type PlayerConstructor = new (data: any, options: { parent: GameObjectInstance }) => PlayerInstance;

/**
 * Инстанс `Viewer` после `new Viewer(data, { parent })`.
 */
export type ViewerInstance = GameObjectInstance & {
  userId: string;
  isViewer: true;
  avatarCode?: string;
};

export type ViewerConstructor = new (data: any, options: { parent: GameObjectInstance }) => ViewerInstance;

/**
 * Рантайм: поля — **классы** `(class X extends GameObject { ... })`, не фабрики вида `() => class`.
 * Использовать: `const C = lib.game._objects.Deck; new C(data, { parent })`.
 */
export interface GameObjectsModule {
  Card: CardConstructor;
  Deck: DeckConstructor;
  Player: PlayerConstructor;
  Viewer: ViewerConstructor;
}
