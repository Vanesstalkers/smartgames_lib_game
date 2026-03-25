import type { ApiContextLike, StatusOkResult } from '../../user/types/api';

export interface GameNewParams {
  gameCode: string;
  gameType: string;
  gameConfig: string;
  gameTimer: number;
  teamsCount?: number;
  playerCount?: number;
  maxPlayersInGame?: any;
  minPlayersToStart?: any;
  gameRoundLimit?: number;
  difficulty?: any;
}

export interface GameJoinParams {
  gameId: string;
  viewerMode?: boolean;
  [key: string]: any;
}

export interface GameEnterParams {
  gameId: string;
}

export interface GameRestoreParams {
  gameType: string;
  gameId: string;
  needLoadGame?: boolean;
}

export interface GameRestoreForcedParams {
  round?: number;
  roundStep?: string;
}

export interface GameShowLogsParams {
  lastItemTime?: number;
}

export interface GameCardsParams {
  selectGroup?: string;
  template?: string;
}

export type GameNewResult =
  | { status: 'ok'; gameId: string }
  | { status: 'error'; returnToLobby: boolean };

export type GameJoinResult =
  | StatusOkResult
  | { status: 'error'; returnToLobby: boolean };

export type GameEnterResult = StatusOkResult & {
  gameId: string;
  playerId?: string;
  viewerId?: string;
};

export type GameRestoreResult =
  | StatusOkResult
  | { status: 'error'; returnToLobby: boolean };

export type GameNewMethod = (context: ApiContextLike, data: GameNewParams) => Promise<GameNewResult>;
export type GameJoinMethod = (context: ApiContextLike, data: GameJoinParams) => Promise<GameJoinResult>;
export type GameEnterMethod = (context: ApiContextLike, data: GameEnterParams) => Promise<GameEnterResult>;
export type GameLeaveMethod = (context: ApiContextLike) => Promise<StatusOkResult>;
export type GameActionMethod = (context: ApiContextLike, actionData: Record<string, any>) => Promise<StatusOkResult>;
export type GameRestoreMethod = (context: ApiContextLike, data: GameRestoreParams) => Promise<GameRestoreResult>;
export type GameRestoreForcedMethod = (
  context: ApiContextLike,
  data?: GameRestoreForcedParams
) => Promise<StatusOkResult | unknown>;
export type GameGetRestorableGamesMethod = (context: ApiContextLike) => Promise<{ games: LastGameEntry[] }>;

export interface LastGameEntry {
  gameId: string;
  gameCode: string;
  gameType: string;
  gameConfig: string;
  addTime: number;
  playerId?: string;
}

export type GameGetRulesMethod = (context: ApiContextLike) => Promise<{ status: 'ok'; rules: any }>;
export type GameCardsMethod = (
  context: ApiContextLike,
  data?: GameCardsParams
) => Promise<{ status: 'ok'; cards: any }>;
export type GameShowLogsMethod = (context: ApiContextLike, data?: GameShowLogsParams) => Promise<StatusOkResult>;

export interface GameApiMethods {
  new: GameNewMethod;
  join: GameJoinMethod;
  enter: GameEnterMethod;
  leave: GameLeaveMethod;
  action: GameActionMethod;
  restore: GameRestoreMethod;
  restoreForced: GameRestoreForcedMethod;
  getRestorableGames: GameGetRestorableGamesMethod;
  getRules: GameGetRulesMethod;
  cards: GameCardsMethod;
  showLogs: GameShowLogsMethod;
}
