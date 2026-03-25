import type GameEvent from './GameEvent';

declare class GameObject {
  _id: string;
  _col: string;
  code: string;
  fakeId: Record<string, string>;
  eventData: { activeEvents: GameEvent[]; [key: string]: any };

  constructor(data: any, options?: { col?: string; parent?: GameObject });

  id(): string;
  preventSaveFields(fields?: string[]): string[] | true;
  updateFakeId(data: { parentId: string }): void;
  set(val: Record<string, any>, config?: Record<string, any>): void;
  prepareChanges(val: Record<string, any>): Record<string, any>;
  markNew(config?: { saveToDB?: boolean; changes?: Record<string, any> }): void;
  markDelete(config?: { saveToDB?: boolean }): void;
  default_customObjectCode(
    data: { codeTemplate: string; replacementFragment: string },
    payload: { _code?: string }
  ): string;
  addToParentsObjectStorage(): void;
  addToObjectStorage(obj: GameObject): void;
  deleteFromParentsObjectStorage(): void;
  deleteFromObjectStorage(obj: GameObject): void;
  getObjectById(...args: any[]): GameObject | null;
  get(_id: string): GameObject | null;
  getObjectByCode(): GameObject | undefined;
  find(code: string): GameObject | undefined;
  getCodePrefix(): string;
  getCodeSuffix(): string;
  getCodeTemplate(_code: string): string;
  shortCode(): string;
  getAllObjects(query?: { directParent?: GameObject }): GameObject[];
  select(query?: string | Record<string, any>): GameObject[];
  setParent(parent: GameObject | null): void;
  setFakeParent(parent: GameObject | null): void;
  updateParent(newParent: GameObject): void;
  parent(): GameObject | null;
  getParent(): GameObject | null;
  findParent(query?: { className?: string; directParent?: GameObject | boolean }): GameObject | null;
  matches(query?: { className?: string }): boolean;
  is(className: string): boolean;
  game(game?: GameObject): GameObject;
  isGame(): boolean;
  getStore(): Record<string, Record<string, GameObject>>;
  getFlattenStore(): Record<string, GameObject>;
  broadcastableFields(fields?: string[]): string[] | true;
  preventBroadcastFields(fields?: string[]): string[] | true;
  publicStaticFields(data?: any): any;
  prepareSaveData(): any;
  prepareBroadcastData(data: { data: any; player: any; viewerMode?: boolean }): { visibleId: string; preparedData: any };
  getEvent(eventName: string): any;
  initEvent(
    eventData: any,
    options?: { game?: GameObject; player?: any; allowedPlayers?: any[]; publicHandlers?: string[]; initData?: any }
  ): GameEvent;
  findEvent(attr?: Record<string, any>): GameEvent | undefined;
  addEvent(event: GameEvent): void;
  removeEvent(event: GameEvent): void;
  hasDiceReplacementEvent(): boolean;
}

export = GameObject;
