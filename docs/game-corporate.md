# Корпоративная игра (gameType: corporate)

Описание корпоративной игры: структура супер-игры и команд, подключение игроков (playerJoin), ожидание и старт (teamReady), а также восстановление после рестарта сервера и при откате на раунд. Общий механизм восстановления — в [Механизм восстановления игры](game-restoration.md).

---

## Структура корпоративной игры

Корпоративная игра — это **супер-игра** (CorporateSuperGame, `domain/game/corporate/class.js`): один экземпляр в `lib.store('game')` с полем **gamesMap**, в котором для каждой команды хранится своя **под-игра** (экземпляр `domain.game.corporate.classGame`). У супер-игры есть **roundPool** (circularArray) для режима competition — очередь/пул команд по раундам. При создании игры (`create`) для каждой команды создаётся под-игра через `classGame.create(...)`, в gamesMap записывается пустой объект под id команды, в roundPool добавляется ключ `'common'` со списком всех команд. Под-игры используют объекты из `domain.game.corporate._objects` (Bridge, Card, Dice, Plane, Player, TableSuper, Zone, ZoneSide и др.).

---

## Подключение игрока к игре (playerJoin)

**Файл:** [`application/domain/game/corporate/class.js`](../../../domain/game/corporate/class.js)

Метод **playerJoin** переопределён относительно базового класса игры для поддержки команд и двух сценариев: обычное присоединение (с клиента с указанием команды) и повторное подключение восстановленного игрока (при восстановлении игры).

### Параметры

- **playerId** — опционально; если передан, игрок считается уже существующим в состоянии (восстановленный игрок, **restoredPlayer**).
- **userId**, **userName** — идентификация пользователя.
- **teamId** — id под-игры (команды), в которую встаёт игрок; используется только когда слот выбирается автоматически (не restoredPlayer).

### Поиск или создание слота игрока

1. **restoredPlayer** (передан `playerId`): игрок берётся по `this.get(playerId)` (супер-игра хранит всех игроков в своём store).
2. **Новый игрок**: вызывается **getFreePlayerSlot({ game: this.get(teamId) })**. В супер-игре проверяется лимит **maxPlayersInGame**; если `game` не передан, выбирается команда с минимальным числом игроков (`getAllGames().sort(...)[0]`). Поиск свободного слота выполняется **в под-игре**: вызывается **game.getFreePlayerSlot()** из логики lib.game.class (поиск существующего слота — игрок без `userId`); если слот не найден, в под-игре создаётся новый через `game.run('addPlayer', { ...playerTemplates['default'], _code: playerCount + 1 })`.

Если свободных мест нет (`maxPlayersInGame` достигнут или слот не найден), выбрасывается ошибка «Свободных мест не осталось».

### Установка данных и user.joinGame()

- Игроку выставляются `ready: true`, `userId`, `userName`; в лог пишется сообщение о присоединении.
- **Критично:** вызывается **user.joinGame({ gameId, playerId, gameCode, gameType, isSinglePlayer })**. Без этого вызова `user.gameId` остаётся `undefined`, и при последующем вызове `game.api.enter` возникнет ошибка «Пользователь не участвует в игре». После `user.joinGame()` обновляются сессии пользователя и эмитится событие `joinGame` для фронтенда.

### Ветка restoredPlayer

Если это восстановленный игрок (`restoredPlayer === true`):
- Если игрок — тимлид и у него ещё не нажато «Готов» в команде, вызывается `playerGame.run('teamReady', {}, player)`, чтобы не блокировать старт команды.
- Выполняется `saveChanges()` и выход из метода — без обновления gamesMap и без логики «новый игрок в IN_PROCESS».

### Ветка нового игрока (не restoredPlayer)

- В под-игре: `playerGame.set({ disabled: false, playerMap: { [playerId]: userId } })`.
- В супер-игре: `this.set({ gamesMap: { [player.gameId]: { [playerId]: userId } } })` — привязка игрока к команде в gamesMap.
- Если игра уже в статусе **IN_PROCESS**:
  - **cooperative**: при слиянии команд (`playerGame.merged`) и если команды ещё нет в `turnOrder`, она добавляется в `turnOrder`.
  - **competition**: если команда не в слиянии, она добавляется в `roundPool.get('common').data` и пул помечается активным; если команда в слиянии — активируется запись roundPool по id команды.
- Выполняется `saveChanges()`.

При любой ошибке в try/catch ошибка рассылается сессиям пользователя и инициируется logout (hideGameIframe).

---

## Ожидание игроков и старт (initPlayerWaitEvents, teamReady)

Для корпоративной игры используется **domain/game/actions/initPlayerWaitEvents** (а не lib): только обработчик **PLAYER_JOIN** (без TRIGGER). При подключении игрока выставляется `ready: true`. Если остался свободный слот (`getFreePlayerSlot()`), событие не снимается. Когда все слоты заняты, вызывается `this.emit('RESET')`; при **restorationMode** сразу вызывается `game.restart()`, иначе `game.run('initPrepareGameEvents', {}, player)`.

Дальнейший старт идёт через **teamReady** (кнопка «Готов» в команде). В **domain/game/corporate/actions/teamReady.js**: у нажавшего выставляется `eventData.teamReady`; проверяется, что у всех команд тимлид нажал «Готов». Если да и при этом **superGame.restorationMode** — вызывается `superGame.restart()` (без putStartPlanes). Иначе выполняется обычный сценарий: putStartPlanes, статус PREPARE_START, initPrepareGameEvents по командам.

---

## Раунды в корпоративной игре

Раунды управляются супер-игрой; у каждой под-игры (команды) есть свой номер раунда (`round`), флаг **roundReady** (команда завершила раунд) и при слиянии — участие в общем **turnOrder** и **roundActiveGame** / **roundActivePlayer**. В зависимости от режима (**competition** или **cooperative**) используется либо **roundPool**, либо **turnOrder** и логика слияния.

### roundStart (супер-игра)

**Файл:** [`domain/game/corporate/actions/roundStart.js`](../../../domain/game/corporate/actions/roundStart.js)

Вызывается у супер-игры из общего цепочки (после roundEnd). Номер раунда супер-игры увеличивается; выставляется `statusLabel: "Раунд N"`, `round: newRoundNumber`. Если задан **gameRoundLimit** и раунд его превышает — вызывается `endGame` с сообщением о лимите раундов.

- **competition:** из **roundPool** берётся следующий набор команд: `this.roundPool.next({ fixState: true })`. Только эти команды переходят к активному раунду: у каждой `roundReady: false`, вызывается `game.run('domain.roundStart')`. Остальные команды лишь получают обновлённый номер раунда и делают `dumpState`. Затем у «активных» команд вызывается `playRoundStartCards({ enabled: true })`. Супер-игра делает `dumpState()`. Таким образом, в одном раунде супер-игры ходят только команды из текущей ячейки roundPool (например, из ключа `'common'` или по очереди по ключам).

- **cooperative:** проверяется **allGamesMerged()**. Если все команды слились, активная команда на этот ход определяется как **selectNextActiveGame()** (следующая в **turnOrder**, с учётом extraTurn). Для каждой под-игры: если это не активная команда или игра отключена (`disabled`), только обновляется `round` и вызывается `dumpState`. Для активной команды выставляется `roundReady: false`, вызывается `game.run('domain.roundStart')`. После этого либо у супер-игры вызывается `playRoundStartCards()` (если все слились), либо у каждой «стартующей» команды по отдельности. Супер-игра делает `dumpState()`.

### roundSteps (под-игра)

**Файл:** [`domain/game/corporate/actions/roundSteps.js`](../../../domain/game/corporate/actions/roundSteps.js)

Вызывается у под-игры при вызове у неё базового roundStart (через `domain.roundStart`). Определяется следующий активный игрок в команде (`selectNextActivePlayer`), в руку игрока из колоды домино переносится одна костяшка, в лог пишется «Начало раунда №N». Карта в начале раунда добавляется через **smartMoveRandomCard** — либо в руку игрока, либо в активную колоду (в зависимости от настроек и mergeStatus в cooperative). Выставляется таймер раунда (`lastRoundTimerConfig`), игрок активируется. Возвращаются `newRoundLogEvents` и `newRoundNumber` для использования в базовом roundStart.

### roundEnd (под-игра)

**Файл:** [`domain/game/corporate/actions/roundEnd.js`](../../../domain/game/corporate/actions/roundEnd.js)

Вызывается у под-игры (команды) по таймеру или при явном завершении хода. Текущий активный игрок деактивируется. Если в команде все игроки завершили раунд (**checkAllPlayersFinishRound**), у команды выставляется **roundReady: true**, рассылается событие DICES_DISABLED.

- **competition:** берётся текущий набор игр из roundPool: `superGame.roundPool.current({ loadFixedState: true })` (список зафиксирован на начало раунда). Если хотя бы у одной команды из этого набора ещё не `roundReady`, выход — раунд супер-игры не завершён. Когда все команды из набора завершили раунд: у каждой вызывается `toggleEventHandlers('END_ROUND')` (у активного игрока команды), то же для супер-игры (roundActivePlayer). Затем у всех команд из набора: dropPlayedCards, checkCrutches, у активного игрока checkHandDiceLimit. После этого вызывается **superGame.run('roundStart')** — начинается следующий раунд супер-игры.

- **cooperative:** если не все команды завершили раунд (**!superGame.allGamesRoundReady()**), выход. Когда все выставили roundReady: у всех под-игр и супер-игры вызывается END_ROUND (toggleEventHandlers), затем dropPlayedCards и checkCrutches у супер-игры и у под-игр (с учётом allGamesMerged и roundActiveGame). У активных игроков вызывается checkHandDiceLimit. Затем **superGame.run('roundStart')** — переход к следующему раунду; при слиянии активной будет следующая команда в turnOrder (selectNextActiveGame).

### roundPool и turnOrder

- **roundPool** (lib.utils.circularArray): хранит по ключам (например, `'common'` или id команды) списки под-игр и признак активности. **next({ fixState: true })** переводит пул к следующей ячейке и возвращает список игр для текущей ячейки (состояние фиксируется на начало раунда). **current({ loadFixedState: true })** возвращает список игр из зафиксированного состояния (на начало раунда), чтобы не учитывать команды, вышедшие в середине раунда. В competition раунд супер-игры не считается завершённым, пока все команды из этой ячейки не выставят roundReady.

- **turnOrder**: массив id под-игр, задаёт порядок хода команд в режиме cooperative при слиянии (**allGamesMerged**). **roundActiveGameId** / **roundActivePlayerId** хранятся на супер-игре; **selectNextActiveGame** переключает активную команду на следующую в turnOrder (с учётом extraTurn у игрока).

### Сводка по раундам

| Режим        | Кто ходит в раунде супер-игры              | Переход к следующему раунду |
|-------------|---------------------------------------------|-----------------------------|
| competition | Команды из roundPool.current()              | Когда у всех из этого набора roundReady → roundStart супер-игры, roundPool.next() |
| cooperative | Пока не слились — все по очереди по своим раундам; после слияния — одна команда из turnOrder за ход | Когда allGamesRoundReady() → END_ROUND у всех, затем roundStart супер-игры, selectNextActiveGame() |

У каждой под-игры свой **round** и **roundReady**; дамп состояния супер-игры при dumpState включает **roundPool.toJSON()** и дампы под-игр (#dumps), чтобы восстановление могло воспроизвести раунд и очередь команд.

---

## Восстановление корпоративной игры

### loadGame для corporate (domain/game/actions/loadGame.js)

Вызывается тот же entry point: `domain.game.actions.loadGame` с `gameType: 'corporate'`, `gameId`, `lobbyId`, опционально `round`. Загрузка из БД: `game.load({ fromDB: { id: gameId, query, fromDump: true, processData } })`, где **processData** для corporate — отдельная функция.

**processData для corporate** получает `loadedInstance` (восстановленная супер-игра из дампа) и `loadedData` (сырые данные дампа):

1. В супер-игру подставляются `gamesMap` из дампа, выставляется `restorationMode = true`, вызывается `corporateGame.run('fillGameData', { ...loadedData, playerMap: {} })`.
2. Для каждой команды из `loadedData.gamesMap` создаётся экземпляр под-игры: `new domain.game.corporate.classGame({ id, _code }, { parent: corporateGame }).load({ fromData: gameData }, { initStore: true })`. Данные команды берутся из `loadedData.store.game[gameId]`. У каждой под-игры выставляется `restorationMode`, вызывается `game.run('fillGameData', { ...gameData, playerMap: {} })`. Под-игры складываются в локальный `gamesMap`, затем супер-игра обновляет своё состояние.
3. Восстановление игроков: по `loadedData.playerMap` для каждого `playerId` берётся `playerData` из `this.store.player[playerId]`. У тимлидов сбрасывается `eventData.teamReady`. Для каждого игрока вызывается `game.run('addPlayer', playerData)` в соответствующую под-игру (по `playerData.gameId`).
4. Восстанавливается **roundPool**: из `loadedData.roundPool` восстанавливаются ключи, списки игр по ключам и активное состояние (`roundPool.add(key, games, { active })`, `roundPool.setKey(pool.currentKey)`).

После processData выполняется общая часть loadGame: addGame в лобби с restorationMode, updateGameAtCache, initPlayerWaitEvents, статус RESTORING_GAME → WAIT_FOR_PLAYERS, у всех игроков `ready: false`.

### restart() корпоративной супер-игры

В **domain/game/corporate/class.js** метод **restart()**:
- Сбрасывает `restorationMode: null`, выставляет `status: 'IN_PROCESS'`, вызывает `initGameProcessEvents`.
- Для **competition**: у всех под-игр выставляется roundReady, initGameProcessEvents; из roundPool берётся текущий набор игр (`roundPool.current({ fixState: true })`), для каждой перезапускается таймер и вызывается playRoundStartCards.
- Для **cooperative**: проверяется allGamesMerged и roundActiveGame; у всех под-игр initGameProcessEvents, таймер и при необходимости playRoundStartCards выставляются с учётом активной команды и слияния.

### restoreForced для corporate (domain/game/api/restoreForced.js)

Домен переопределяет **game.api.restoreForced**: параметр только **round** (без roundStep). Поиск дампа: `game_dump` по `_gameid` и `round`, limit 1. Очистка: рассылка «пустого» состояния подписчикам, clearChanges, **game.removeGame({ preventDeleteDumps: true })**. У корпоративной супер-игры removeGame рекурсивно вызывает removeGame у всех под-игр из getAllGames(), затем super.removeGame. Загрузка: **domain.game.actions.loadGame** с параметром `round`. Повторное подключение участников: обход по `game.store.player` и `game.store.viewer` супер-игры; для каждого с `ready === true` вызывается `restoredGame.playerJoin({ userId, userName, playerId: id })` или viewerJoin — срабатывает ветка restoredPlayer в playerJoin.

В итоге корпоративная игра откатывается на выбранный раунд, все команды и roundPool восстанавливаются из дампа, игроки и зрители снова подключаются к супер-игре.
