export interface GameFlushModule {
  statsOnStart: Record<string, number> | null;
  list: any[];
  exec(): void;
}

declare const flush: GameFlushModule;
export = flush;
