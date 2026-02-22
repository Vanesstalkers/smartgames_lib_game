# Процесс игры с точки зрения кода

Документ объединяет описание **логики подключения игрока к игре** (join/enter) и **жизненного цикла игры** от создания до завершения.

---

## Логика подключения игрока к игре

### Обзор процесса

Процесс подключения игрока к игре состоит из нескольких этапов, которые происходят как на фронтенде, так и на бэкенде.

### Фронтенд (клиентская часть)

#### 1. Инициация подключения

**Файл:** [`application/lib/lobby/front/components/game-item.vue`](../../../lobby/front/components/game-item.vue)

Пользователь нажимает кнопку "Присоединиться" в списке игр. Компонент `game-item` эмитит событие `join` с данными:

```javascript
{
  gameId: game.id,
  gameCode: game.gameCode,
  gameType: game.gameType  // опционально
}
```

#### 2. Обработка события подключения

**Файл:** [`application/lib/lobby/front/components/games.vue`](../../../lobby/front/components/games.vue)

Метод `joinGame()` обрабатывает событие подключения:

1. **Проверка активности игры:**
   - Вызывается `lobby.api.checkGame` для проверки, что игровой сервер активен
   - Если игра не активна, подключение отменяется

2. **Вызов API подключения:**
   - Вызывается `game.api.join` с параметрами: `{ gameId, viewerMode, teamId }`
   - После успешного вызова API перенаправление происходит автоматически через событие `joinGame` от сервера

#### 3. Обработка события joinGame

**Файл:** [`application/lib/lobby/front/components/games.vue`](../../../lobby/front/components/games.vue) (метод `created()`)

Устанавливается обработчик события `state.emit.joinGame`, который:
- Получает данные: `{ gameCode, gameType, gameId }`
- Выполняет перенаправление на страницу игры через `app.$router.push()`

**Файл:** [`front/src/main.js`](../../../../front/src/main.js)

Событие `joinGame` приходит через WebSocket от сервера:
- `session.emit('joinGame', ...)` на сервере отправляет событие через `api.action.on('emit')`
- Обработчик вызывает `state.emit.joinGame(data)`

### Бэкенд (серверная часть)

#### 1. API endpoint: game.api.join

**Файл:** [`application/lib/game/api/join.js`](../../api/join.js)

Основной метод подключения к игре:

1. **Проверка текущего состояния:**
   - Проверяет, не подключен ли пользователь к другой игре
   - Если подключен к другой игре, возвращает ошибку

2. **Установка gameId для сессий:**
   - Устанавливает `gameId` для всех сессий пользователя
   - Это делается заранее на случай повторного вызова API

3. **Вызов метода игры:**
   - Вызывает `game.playerJoin(data)` или `game.viewerJoin(data)` в зависимости от режима
   - Передает данные: `{ userId, userName, ...args }`

#### 2. Метод игры: game.playerJoin

**Файл:** [`application/lib/game/class.js`](../../class.js) (базовый класс)
**Файл:** [`application/domain/game/corporate/class.js`](../../../domain/game/corporate/class.js) (для corporate-игр)
**Файл:** [`application/domain/game/poker/class.js`](../../../domain/game/poker/class.js) (для poker-игр)

**Базовый класс (lib/game/class.js):**

1. **Проверка статуса игры:**
   - Проверяет, что игра не завершена (`status !== 'FINISHED'`)

2. **Поиск или создание игрока:**
   - Если передан `playerId`, использует существующего игрока
   - Иначе получает свободный слот через `getFreePlayerSlot()`

3. **Установка данных игрока:**
   - Устанавливает `userId`, `userName`, `avatarCode`

4. **Вызов user.joinGame():**
   - **ВАЖНО:** Вызывает `user.joinGame()` для установки `user.gameId`
   - Передает: `{ gameId, playerId, gameCode, gameType }`

5. **Обработка событий:**
   - Вызывает `toggleEventHandlers('PLAYER_JOIN')`
   - Если игра с ИИ, создает игрока-компьютер

6. **Сохранение изменений:**
   - Вызывает `game.saveChanges()`

**Corporate класс (domain/game/corporate/class.js):** переопределяет `playerJoin` для поддержки команд (teamId, getFreePlayerSlot по команде, gamesMap, roundPool/turnOrder). Подробное описание корпоративной игры, подключения и восстановления: [Корпоративная игра](game-corporate.md).

#### 3. Метод пользователя: user.joinGame

**Файл:** [`application/lib/game/User.js`](../../User.js)

Устанавливает связь пользователя с игрой:

1. **Обработка туториалов:**
   - Сбрасывает текущий туториал
   - Если нужно, запускает туториал начала игры

2. **Установка данных:**
   - Устанавливает `gameId`, `playerId`, `viewerId` в объект пользователя
   - Инициализирует рейтинги для игры, если их еще нет

3. **Сохранение изменений:**
   - Вызывает `user.saveChanges()` для сохранения в БД
   - **ВАЖНО:** Это асинхронная операция, которая может занять время

4. **Обновление сессий:**
   - Для каждой сессии пользователя:
     - Устанавливает `gameId`, `playerId`, `viewerId`
     - Сохраняет изменения сессии
     - Эмитит событие `joinGame` для фронтенда

#### 4. API endpoint: game.api.enter

**Файл:** [`application/lib/game/api/enter.js`](../../api/enter.js)

Вызывается при загрузке страницы игры:

1. **Проверка участия:**
   - **КРИТИЧНО:** Проверяет, что `gameId === user.gameId`
   - Если не совпадает, выбрасывает ошибку "Пользователь не участвует в игре"
   - Эта проверка требует, чтобы `user.gameId` был установлен в `user.joinGame()`

2. **Проверка существования игры:**
   - Проверяет, что игра существует в Redis
   - Если игры нет, очищает `user.gameId` и выбрасывает ошибку

3. **Подписка на события:**
   - Игра подписывается на события пользователя: `game.subscribe('user-${userId}')`
   - Пользователь подписывается на события игры: `user.subscribe('game-${gameId}')`
   - Сессия подписывается на события игры для Vue store

4. **Возврат данных:**
   - Возвращает `{ gameId, playerId, viewerId }` для инициализации фронтенда

### Критические моменты (подключение)

**Проблема с corporate играми:** В `corporate/class.js` метод `playerJoin` был переопределен без вызова `user.joinGame()`. Это приводило к тому, что `user.gameId` оставался `undefined` и при вызове `game.api.enter` возникала ошибка "Пользователь не участвует в игре". **Решение:** Добавлен вызов `user.joinGame()` в `corporate.playerJoin()` перед публикацией события.

**Тайминг и асинхронность:** Проверка в `game.api.enter` должна происходить после того, как `user.gameId` сохранен в БД; иначе проверка `gameId === user.gameId` не пройдет.

### Схема потока данных (join → enter)

```
[Фронтенд]
  game-item.vue
    ↓ emit('join', { gameId, gameCode })
  games.vue.joinGame()
    ↓ api.action.call('game.api.join')
    
[Бэкенд]
  game.api.join()
    ↓ game.playerJoin()
      ↓ user.joinGame()
        ↓ user.saveChanges()  // сохранение в БД
        ↓ session.emit('joinGame')  // событие для фронтенда
    
[Фронтенд]
  api.action.on('emit')
    ↓ state.emit.joinGame()
      ↓ app.$router.push('/game/...')
        ↓ Game.vue.mounted()
          ↓ game.api.enter()
            
[Бэкенд]
  game.api.enter()
    ↓ проверка: gameId === user.gameId
    ↓ подписка на события
    ↓ возврат данных
```

### Файлы, участвующие в процессе подключения

**Фронтенд:** game-item.vue, games.vue, front/src/main.js, Game.vue (пути см. выше).

**Бэкенд:** api/join.js, api/enter.js, class.js, domain/game/corporate/class.js, User.js (пути см. выше).

**Отладка:** логи с префиксами `[game.api.join]`, `[game.api.enter]`, `[game.playerJoin]`, `[corporate.playerJoin]`, `[user.joinGame]` (console.debug).

---

## Жизненный цикл игры

Ниже описан жизненный цикл игры: от создания до завершения и как клиент взаимодействует с сервером.

### 1. Создание игры

1. **Клиент** вызывает `game.api.new` (например, из лобби) с параметрами: `gameCode`, `gameType`, `gameConfig`, `gameTimer`, `teamsCount`, `playerCount`, `minPlayersToStart` и др.
2. **api/new.js**:
   - Вызывает `lib.game.flush.exec()` (очистка устаревших игр при необходимости).
   - Определяет класс игры: `domain.game[gameType]?.class || domain.game.class`.
   - Создаёт экземпляр: `await new GameClassGetter().create({ ... })`.
3. **Game.create()** (`class.js`):
   - Берёт настройки из `lib.game.actions.getFilledGamesConfigs()` для данного `gameType` и `gameConfig` (в т.ч. `playerList`, `minPlayersToStart`).
   - Формирует `gameData` (newGame, settings, gameCode, gameType, таймер и т.д.).
   - Вызывает `this.run('fillGameData', gameData)` — доменный или базовый `fillGameData` заполняет игровое состояние (игроки, колоды, поля). Действие берётся через `game.run()`: сначала `domain.game.actions[gameType]?.fillGameData`, затем `domain.game.actions.fillGameData`, затем `lib.game.actions.fillGameData`.
   - Вызывает `this.run('initPlayerWaitEvents')` — подвешивает событие ожидания игроков (см. ниже).
   - Вызывает `super.create({ ...this })` — сохранение в MongoDB (store) и инициализация канала broadcast (подробнее: [lib/store](../../store/README.md)).
   - Регистрирует игру в Redis: `addGameToCache()` (id, gameCode, gameType, workerId, port) для поиска игры другими воркерами/лобби.
4. **api/new.js** (продолжение):
   - Публикует в лобби: `lib.store.broadcaster.publishAction(session, 'lobby-${lobbyId}', 'addGame', { gameId, creator, ... })`, чтобы в списке игр лобби появилась новая игра (подробнее о работе лобби: [lib/lobby](../../lobby/README.md)).
   - Возвращает `{ status: 'ok', gameId }`.

Игра после создания находится в статусе **WAIT_FOR_PLAYERS** (выставляется в `initPlayerWaitEvents`).

### 2. Подключение игроков (join) и вход на страницу (enter)

- **game.api.join** — вызывается из лобби при нажатии «Присоединиться». Проверяет, что пользователь не в другой игре, устанавливает `gameId` у сессий, вызывает `game.playerJoin()` или `game.viewerJoin()`. В `playerJoin` создаётся/находится слот игрока, вызывается `user.joinGame()`, затем `toggleEventHandlers('PLAYER_JOIN')` и `saveChanges()`. Подробнее см. раздел «Логика подключения игрока к игре» выше.
- **game.api.enter** — вызывается при открытии страницы игры. Проверяет `user.gameId === gameId`, подписывает игру на канал пользователя и пользователя на канал игры, возвращает `{ gameId, playerId, viewerId }` для инициализации UI.

### 3. Ожидание игроков и старт (initPlayerWaitEvents → startGame)

- При создании игры вызывается **initPlayerWaitEvents**: в игру вешается одноимённое **событие** (event) с обработчиками `PLAYER_JOIN` и `TRIGGER`.
  - **PLAYER_JOIN**: при присоединении игрока он активируется, получает кнопку «Готов» и подписку на срабатывание (trigger) этого события.
  - Когда игрок нажимает «Готов», вызывается **TRIGGER**: игрок помечается `ready`, деактивируется, событие удаляется у игрока. Если готовых `>= minPlayersToStart`, выполняется:
    - при `restorationMode` — восстановление активных игроков и `game.restart()` (подробнее: [Механизм восстановления игры](game-restoration.md));
    - иначе: `this.emit('RESET')` (уничтожение события ожидания), затем `game.run('initPrepareGameEvents')` (если есть) или сразу `game.run('startGame')`.
- **startGame** (actions/startGame.js):
  - `this.set({ status: 'IN_PROCESS' })`.
  - `this.run('initGameProcessEvents')` — подвешивает общие события процесса игры (например, `gameProcess` с обработчиком `PLAYER_TIMER_END` для авто-окончания раунда по таймеру).
  - `this.run('roundStart')` — переход к первому раунду.

### 4. Раунды: roundStart → roundSteps → roundEnd

- **roundStart** (lib/game/actions/roundStart.js):
  - Резолвит функцию шагов раунда: `domain.game.actions[gameType]?.roundSteps` или `domain.game[gameType]?.actions?.roundSteps` или `domain.game.actions.roundSteps` или `lib.game.actions.roundSteps`.
  - Вызывает `roundStepsFunc.call(this)` и получает `newRoundLogEvents`, `statusLabel`, `newRoundNumber`, `roundStep`, `timerRestart`, `forcedEndRound`.
  - Обновляет логи, выставляет `statusLabel`, `round`, при необходимости `roundStep` и `roundStepsMap`.
  - Если `forcedEndRound` — сразу вызывает `this.run('roundEnd')`.
  - Вызывает `this.dumpState()` (сохранение снимка состояния в MongoDB для восстановления).
  - Перезапускает таймер: `lib.timers.timerRestart(this, timerConfig)`.
- В **lib/game/actions/roundSteps.js** (базовый вариант): вычисляется следующий активный игрок (`selectNextActivePlayer`), номер раунда, логи «Начало раунда №N», перезапуск таймера (с учётом `actionsDisabled`), активация игрока. Домен может переопределять `roundSteps` для своей логики (очередность ходов, фазы и т.д.).
- **roundEnd** (actions/roundEnd.js):
  - Обновляет счётчик просрочки таймера при `timerOverdue`.
  - Текущий активный игрок деактивируется, вызывается `toggleEventHandlers('END_ROUND')`.
  - Затем снова вызывается `this.run('roundStart')` — переход к следующему раунду.

Цикл раундов продолжается до тех пор, пока где-то не будет вызван **endGame** (победа, отмена, таймер и т.д.).

### 5. Действия игрока с клиента (handleAction)

1. **Клиент** (например, `gameGlobals.mjs`) вызывает `api.action.call({ path: 'game.api.action', args: [data] })`, где `data` — объект с полями `name` (имя действия/события) и `data` (параметры).
2. **game.api.action** (api/action.js):
   - По `session.gameId` достаётся игра `lib.store('game').get(session.gameId)`.
   - Проверяется, что игра есть и не в статусе `FINISHED`.
   - Вызывается `await game.handleAction({ ...actionData, sessionUserId: session.userId })`.
3. **Game.handleAction()** (class.js):
   - Определяется игрок: `getPlayerByUserId(userId) || roundActivePlayer()`.
   - Проверки: игрок найден; если действие не `leaveGame` — что игрок в списке активных (или у игрока `disableActivePlayerCheck`); что не заблокированы действия (`roundReady`, `actionsDisabled`), если только это не `roundEnd` или `leaveGame`.
   - Вызов логики: если у игры есть метод `this[eventName]`, вызывается `this[eventName](eventData, player)`, иначе `this.run(eventName, eventData, player)`. `run()` ищет действие в порядке: `domain.game.actions[gameType]?.[actionName]`, `domain.game[gameType]?.actions?.[actionName]`, `domain.game.actions[actionName]`, `lib.game.actions[actionName]`, и вызывает его в контексте игры.
   - После выполнения: `await this.saveChanges()`. При ошибке — если `lib.game.endGameException`, вызывается `removeGame`, иначе ошибка уходит клиенту через `publishAction(..., 'broadcastToSessions', { data: { message, stack } })`, после чего снова `saveChanges()`.

Таким образом, любое действие (ход, розыгрыш карты, завершение раунда и т.д.) приходит как имя события + данные, резолвится в action или метод игры и завершается сохранением и рассылкой.

### 6. События (events) и toggleEventHandlers

- **События** (GameEvent) описываются объектом с `name`, `handlers` (PLAYER_JOIN, TRIGGER, END_ROUND, PLAYER_TIMER_END и т.д.), опционально `init`. Они регистрируются через `game.initEvent(...)` (или у объекта, например игрока) и попадают в `eventListeners` игры по имени обработчика.
- **toggleEventHandlers(handler, data, initPlayer)** — обходит все зарегистрированные события с этим обработчиком, проверяет доступ игрока (`checkAccess`), вызывает `event.emit(handler, data, player)`. Результат обработчика может содержать `preventListenerRemove`, чтобы не удалять слушатель.
- Примеры: при присоединении игрока вызывается `toggleEventHandlers('PLAYER_JOIN', ...)`; при окончании раунда — `toggleEventHandlers('END_ROUND')`; при истечении таймера в `gameProcess` вызывается `game.run('roundEnd', { timerOverdue: true })`.

### 7. Сохранение и рассылка (saveChanges → MongoDB + broadcast)

- Изменения в игре и объектах делаются через `game.set()`, `player.set()` и т.д., что попадает в внутренний буфер изменений (setChanges) store.
- **game.saveChanges()** (наследуется от store): вызывается после каждого значимого шага (handleAction, playerJoin, viewerJoin и т.д.).
- В **lib/store** реализация:
  - `getChanges()` и `clearChanges()` кладут порцию изменений в очередь `#saveQueue`.
  - В `#processQueue()`: для каждой порции формируется MongoDB-обновление (`$set`/`$unset`), выполняется `db.mongo.updateOne(this.#col, query, $update)`.
  - После успешной записи вызывается `this.broadcastData(changes)` — игра формирует данные для канала (с учётом `prepareBroadcastData`, прав видимости для игроков/зрителей) и рассылает подписчикам канала `game-${gameId}`. Клиенты получают обновлённое состояние и перерисовывают UI.

Таким образом, цепочка «действие игрока → handleAction → run(action) → set(...) → saveChanges → MongoDB + broadcast» обеспечивает консистентное состояние на сервере и синхронизацию с клиентами.

### 8. Завершение игры (endGame)

- **endGame** (actions/endGame.js) вызывается с параметрами вроде `winningPlayer`, `canceledByUser`, `msg`.
  - Удаляется таймер: `lib.timers.timerDelete(this)`.
  - Статус игры: `status: 'FINISHED'`, `statusLabel: 'Игра закончена'`.
  - Вызывается `toggleEventHandlers('END_ROUND')` (обработчики могут проверять `game.status === 'FINISHED'`).
  - При наличии победителя — `setWinner({ player: winningPlayer })`, в лог пишется сообщение о победе.
  - Для каждого игрока выставляется `endGameStatus` (win/lose/cancel) и кнопка «Выйти из игры».
  - Публикуется действие `broadcastAction('gameFinished', { gameId, playerEndGameStatus, ... })`.
  - Выбрасывается `lib.game.endGameException` — выше по коду (например, в handleAction или в removeGame) это обрабатывается и вызывается `removeGame()` (удаление из кэша Redis, уведомление пользователей и т.д.).

После этого игра исчезает из активных, клиенты получают финальное состояние и могут выйти со страницы (game.api.leave).
