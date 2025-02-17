// import { Store, BroadcastableStore } from 'application/lib/store/types';

export class GameObject <G extends GameObject<G>> {
  _id: string;
  _col: string;
  protected #game: G;
  #parent: any;
  #_objects: any;
  #fakeParent: any;
  #preventSaveFields: any[];
  #broadcastableFields: any[];
  #publicStaticFields: any;
  constructor(data: any, options?: { col: string, parent: G });
  id(): string;G
  preventSaveFields(fields: any[]): any[];
  updateFakeId({ parentId }: { parentId: any }): void;
  set(val: any, config?: {}): void;
  prepareChanges(val: any): any;
  markNew(config?: { saveToDB?: boolean }): void;
  markDelete(config?: { saveToDB?: boolean }): void;
  addToParentsObjectStorage(): void;
  addToObjectStorage(obj: any): void;
  deleteFromParentsObjectStorage(): void;
  deleteFromObjectStorage(obj: any): void;
  getObjectById(): any;
  get(_id: any): any;
  getObjectByCode(): any;
  find(code: any): any;
  getCodePrefix(): any;
  getCodeSuffix(): any;
  getCodeTemplate(_code: any): any;
  getObjects(): any;
  select(query?: {}): any;
  setParent(parent: any): void;
  setFakeParent(parent: any): void;
  updateParent(newParent: any): void;
  parent(): any;
  getParent(): any;
  findParent({ className, directParent }?: { className?: any; directParent?: any }): any;
  matches({ className }?: { className?: any }): any;
  game(game?: G): G;
  isGame(): this is G;
  getStore(): any;
  getFlattenStore(): any;
  broadcastableFields(fields?: any[]): any[];
  publicStaticFields(data?: any[]): any;
  prepareSaveData(): any;
  prepareBroadcastData({ data, player, viewerMode }: { data?: any; player?: any; viewerMode?: boolean }): any;
  getEvent(eventName: any): any;
  initEvent(event: any, { player, allowedPlayers }?: { player?: any; allowedPlayers?: any }): any;
  findEvent(attr?: {}): any;
  addEvent(event: any): void;
  removeEvent(event: any): void;
 }

/**
 * Default Game
 */
 export default class Game extends GameObject<Game>, Store {
  #logs: { [key: string]: any };
  store: { [key: string]: any };
  playerMap: { [key: string]: any };
  #broadcastObject: { [key: string]: any };
  #broadcastDataAfterHandlers: { [key: string]: any };
  #objectsDefaultClasses: { [key: string]: any };

  constructor(storeData?: any, gameObjectData?: any);

  isCoreGame(): boolean;
  set(val: any, config?: any): void;
  setChanges(val: any, config: any): void;
  markNew(obj: any, config?: { saveToDB?: boolean }): void;
  markDelete(obj: any, config?: { saveToDB?: boolean }): void;
  addToObjectStorage(obj: any): void;
  defaultClasses(map?: any): any;
  select(query?: string | { className: string; directParent?: boolean }): any;
  create(config?: any): Promise<any>;
  addGameToCache(): Promise<void>;
  updateGameAtCache(data?: any): Promise<void>;
  processData(data: any): Promise<void>;
  run(actionPath: any, data?: any, initPlayer?: any): any;
  addEventListener(config: any): void;
  removeEventListener(config: any): void;
  removeAllEventListeners(config: any): void;
  toggleEventHandlers(handler: any, data?: any, initPlayer?: any): void;
  clearEvents(): void;
  triggerEventEnabled(): boolean;
  logs(data?: any, config?: { consoleMsg?: boolean }): any;
  showLogs(config?: any): Promise<void>;
  isSinglePlayer(): boolean;
  players(): any[];
  getPlayerByUserId(id: any): any;
  playerJoin(config: any): Promise<void>;
  viewerJoin(config: any): Promise<void>;
  playerLeave(config: any): Promise<void>;
  selectNextActivePlayer(): any;
  checkWinnerAndFinishGame(): void;
  setWinner({ player }: { player: any }): void;
  getFreePlayerSlot(): any;
  getActivePlayer(): any;
  getActivePlayers(): any[];
  activatePlayers({ publishText, setData, disableSkipRoundCheck }: { publishText?: any; setData?: any; disableSkipRoundCheck?: boolean }): void;
  checkAllPlayersFinishRound(): boolean;

  handleAction({ name: string, data: any, sessionUserId: string }): Promise<void>;

  prepareBroadcastData({ data, userId, viewerMode }: { data?: any; userId?: string; viewerMode?: boolean }): any;
  addBroadcastObject({ col, id }: { col: string; id: any }): void;
  deleteBroadcastObject({ col, id }: { col: string; id: any }): void;

  broadcastDataBeforeHandler(data: any, config?: {}): void;
  broadcastDataAfterHandler(data: any, config?: {}): void;
  broadcastDataVueStoreRuleHandler(data: any, config: any): any;

  removeGame(): Promise<void>;

  onTimerRestart({ timerId, data }: { timerId: string; data?: { time: number; extraTime?: number } }): void;
  onTimerTick({ timerId, data }: { timerId: string; data?: { time?: number } }): Promise<void>;
  onTimerDelete({ timerId }: { timerId: string }): void;

  playerUseTutorialLink({ user }: { user: any }): Promise<void>;
}

export class Store {
  ddd(aaa: {s: number}): string;
}

export interface GameObjectData {
  /**
   * ObjectID-идентификатор
   */                                         
  _id: ObjectId;
}
export interface GameObjectConfig {
  col: string;
  parent: GameObject;
}

interface PlayerData extends GameObjectData {
  userId: string;
}
interface ViewerData extends GameObjectData {
  userId: string;
  avatarCode: string;
}
interface DeckData extends GameObjectData {
  type: string;
  subtype: string;
  itemType: string;
  settings: { itemsUsageLimit: number; itemsStartCount: number };
  access: { [key: string]: object };
}
interface CardData extends GameObjectData {
  name: string;
}

export class PlayerBase<G extends GameObject<G>> extends GameObject<G> {
  constructor(data: any, config: { parent?: G });
}

export namespace objects {
  declare class Player extends PlayerBase<Game> {
    nextPlayer(): Player;
    skipRoundCheck(): boolean;
    returnTableCardsToHand(): void;
    triggerEventEnabled(): boolean;
    activate(options?: { setData?: any; publishText?: string }): void;
    deactivate(): void;
    publishInfo(info?: { text?: string; hideTime?: number }): void;
  }
  class Viewer extends GameObject {
    constructor(data: ViewerData, config: GameObjectConfig);
  }
  class Deck extends GameObject {
    constructor(data: DeckData, config: GameObjectConfig);
    addItem(item: GameObject | object): boolean;
  }
  class Card extends GameObject {
    constructor(data: CardData, config: GameObjectConfig);
    /**
     * Перемещает карту к новому держателю (колоду)
     * @param {GameObject} target - колода для перемещения
     */
    moveToTarget(target: GameObject): boolean;
  }
}

/* type ScalarValue = string | number | undefined;

export interface GameClass {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  logger: { db: Function; debug: Function };
}
 */

/* 
export class Query {
  constructor(
    db: Database,
    table: string,
    fields: Array<string>,
    ...where: Array<object>
  );
  order(field: string | Array<string>): Query;
  desc(field: string | Array<string>): Query;
  limit(count: number): Query;
  offset(count: number): Query;
  then(resolve: (rows: Array<object>) => void, reject: Function): void;
  toString(): string;
  toObject(): QueryObject;
  static from(db: Database, metadata: QueryObject): Query;
}

interface QueryObject {
  table: string;
  fields: string | Array<string>;
  where?: Array<object>;
  options: Array<object>;
}

export class Modify {
  constructor(db: Database, sql: string, args: Array<string>);
  returning(field: string | Array<string>): Modify;
  then(resolve: (rows: Array<object>) => void, reject: Function): void;
  toString(): string;
  toObject(): ModifyObject;
  static from(db: Database, metadata: ModifyObject): Modify;
}

interface ModifyObject {
  sql: string;
  args: Array<string>;
  options: Array<object>;
}
 */
