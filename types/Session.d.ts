import type { LobbySessionClass, LobbySessionInstance } from '../../lobby/types/Session';
import type { GameUserClass } from './User';

export interface GameSessionInstance extends LobbySessionInstance {
  getUserClass(): GameUserClass;
}

export interface GameSessionClass extends LobbySessionClass {
  new (data?: { id?: string; client?: any }): GameSessionInstance;
}

declare function createGameSessionClass(): GameSessionClass;

export = createGameSessionClass;
