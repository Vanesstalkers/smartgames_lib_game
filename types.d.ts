export default class Game extends GameObject {
  constructor();
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

export class GameObject {
  /**
   * ObjectID-идентификатор
   */
  _id: ObjectId;
  col: string;
  #broadcastableFields: string[];
  constructor(data: GameObjectData, config: GameObjectConfig);
  getParent(): GameObject;
  /**
   * Возвращает или сохраняет список полей, которые можно публиковать
   * @param {string[]} data - массив полей для публикации
   */
  broadcastableFields(): string[] | void;
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
export namespace objects {
  class Player extends GameObject {
    constructor(data: PlayerData, config: GameObjectConfig);
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
