import type { TutorialDefinition, UpdateTutorialData } from '../../helper/types/helper';
import type { LobbyUserInstance } from '../../lobby/types/User';

export interface LastGameEntry {
  gameId: string;
  gameCode: string;
  gameType: string;
  gameConfig: string;
  addTime: number;
  playerId?: string;
}

export interface GameUserInstance extends LobbyUserInstance {
  lastGames: LastGameEntry[];
  gameId?: string;
  playerId?: string;
  viewerId?: string;
  teamId?: string;
  rankings?: Record<string, any>;

  processData(data: Record<string, any>, broadcaster?: string): Promise<void>;
  joinGame(data: {
    gameId: string;
    playerId?: string;
    teamId?: string;
    viewerId?: string;
    restoreAction?: boolean;
    checkTutorials?: boolean;
  }): Promise<void>;
  leaveGame(): Promise<void>;
  gameFinished(data?: {
    gameCode?: string;
    userEndGameStatusMap?: Record<string, string>;
    gameAward?: number;
    roundCount?: number;
    preventCalcStats?: boolean;
  }): Promise<void>;
  updateTutorial(data: UpdateTutorialData | Record<string, any>): Promise<void>;
  getTutorial(formattedPath: string): TutorialDefinition;
}

export interface GameUserClass {
  new (...args: any[]): GameUserInstance;
}

declare function createGameUserClass(): GameUserClass;

export = createGameUserClass;
