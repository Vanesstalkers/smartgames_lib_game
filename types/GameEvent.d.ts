declare class GameEvent {
  name?: string;
  constructor(data: { init?: (initData?: any) => any; handlers?: Record<string, any>; name?: string; [key: string]: any });
  destroy(): void;
  source(data?: any): any;
  sourceId(): string;
  game(data?: any): any;
  player(data?: any): any;
  allowedPlayers(data?: any): any[];
  publicHandlers(data?: any): string[];
  set(val: Record<string, any>, config?: Record<string, any>): void;
  getTitle(): string;
  checkAccess(player: any, data: { handler: string }): boolean;
  eventContext(): {
    source: any;
    game: any;
    player: any;
    allowedPlayers: any[];
    sourceId: string;
  };
  hasInitAction(): boolean;
  hasHandler(handler: string): boolean;
  init(initData?: any): any;
  handlers(handler?: string): any;
  setHandler(handler: string, fn: (...args: any[]) => any): void;
  emit(handler: string, data?: any, player?: any): any;
}

export = GameEvent;
