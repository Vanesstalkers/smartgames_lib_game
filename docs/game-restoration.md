# Механизм восстановления игры

Описание того, как игра восстанавливается после рестарта сервера или по инициативе игрока (восстановление на выбранный раунд).

---

## 1. Снимки состояния (dump)

- В начале каждого раунда **roundStart** вызывает `this.dumpState()` (см. [Процесс игры](game-process.md)).
- **dumpState()** (lib/store): в коллекцию `{col}_dump` (например, `game_dump`) записывается клон текущего состояния игры: `lib.utils.structuredClone(this)` с полями `_gameid` (ObjectID игры), `_dumptime`, `round` и т.д. Идентификатор документа в dump — свой (`_id`), не совпадает с id игры.
- Снимки позволяют:
  - поднять игру с диска после рестарта воркера, восстановив последний сохранённый раунд;
  - откатить игру на выбранный раунд/шаг (restoreForced).

---

## 2. Восстановление после рестарта сервера (loadGame + restorationMode)

Игра могла идти на одном воркере; после рестарта процесс завершился, экземпляр игры в памяти исчез, но данные есть в MongoDB (и в `game_dump`).

### Когда вызывается

- Пользователь возвращается в лобби (у него в user сохранены `gameId`, `playerId`/`viewerId`). При входе в лобби **lobby.api.enter** проверяет `user.gameId`: если пользователь был в игре, смотрит запись в Redis (`db.redis.hget('games', gameId)`). Если игры в Redis нет или канал игры не отвечает (publishAction fakeAction), считается, что игру нужно загрузить с диска — в ответ клиенту возвращается `restoreGame: { gameCode, gameType, gameId, needLoadGame: true }`. Клиент затем вызывает **game.api.restore** с этими данными.

### loadGame (actions/loadGame.js)

- Создаётся экземпляр игры: `new GameClassGetter({ id: gameId })`.
- Загрузка **из дампа**: `game.load({ fromDB: { id: gameId, query, fromDump: true, processData } })`.
  - **loadFromDB** (store): в коллекции `game_dump` ищется документ по `_gameid = gameId` и опционально по `query` (round, roundStep); сортировка `round: -1, _dumptime: -1`, limit 1 — берётся последний снимок. Документ удаляется из dump, его данные (с подставленным `_id` игры) вставляются в коллекцию `game`. Таким образом, состояние игры в основной коллекции заменяется состоянием из снимка.
  - После загрузки вызывается **processData**: `game.run('fillGameData', loadedData)` — доменная логика может дообработать загруженные данные.
- Дальше:
  - В канал лобби публикуется **addGame** с флагом `restorationMode: true` (лобби добавляет игру в список и подписывается на неё с тем же правилом lobbySub).
  - У игры выставляется `game.restorationMode = true`.
  - В Redis обновляется кэш игры: `updateGameAtCache({ restorationMode: true, id, gameCode, gameType, workerId, port })` — теперь другие запросы видят, что игра «живёт» на этом воркере и в режиме восстановления.
  - Вызывается `game.run('initPlayerWaitEvents')` — вешается событие ожидания игроков; статус переводится в `RESTORING_GAME`, затем в `WAIT_FOR_PLAYERS` (в init события).
  - У всех игроков сбрасывается `ready: false`, чтобы они заново нажали «Готов» после восстановления.
- Возвращается экземпляр игры (уже в памяти и в `lib.store('game')`).

### game.api.restore (api/restore.js)

Вызывается клиентом после входа в лобби, если в ответе пришло `restoreGame`.

- Если у пользователя есть другой `gameId` — возврат ошибки и сброс привязки к игре.
- **needLoadGame === true**: вызывается **loadAndJoinGame**: внутри вызывается **loadGame** (см. выше), затем `game.playerJoin` или `game.viewerJoin` для этого пользователя. Игра поднимается с диска и пользователь подключается к ней.
- **needLoadGame === false**: смотрим Redis. Если в кэше игры указано `restorationMode`, игра уже загружена на этом воркере (кто-то уже вызвал loadGame); тогда берётся игра из `lib.store('game').get(gameId)` и вызывается только `joinGame` (playerJoin/viewerJoin). Иначе вызывается только `user.joinGame(...)` (игра уже в памяти, пользователь просто восстанавливает связь).

### Продолжение после «Готов» (initPlayerWaitEvents, TRIGGER)

- Когда восстановленный игрок нажимает «Готов», срабатывает обработчик **TRIGGER** в initPlayerWaitEvents.
- Если `game.restorationMode === true`, то:
  - Восстанавливаются активные игроки: в `this.activePlayers` (сохранённые при init при restorationMode) лежат ссылки на игроков и их кнопки; для каждого вызывается `player.activate({ setData: { eventData: { controlBtn } } })`.
  - Вызывается **game.restart()**: `status: 'IN_PROCESS'`, `initGameProcessEvents`, перезапуск таймера раунда. Игра продолжается с текущего раунда без повторного roundStart (состояние уже из дампа).

Таким образом, цепочка «loadGame → restorationMode → initPlayerWaitEvents → TRIGGER при restorationMode → restart» обеспечивает продолжение игры после рестарта сервера.

---

## 3. Принудительное восстановление на раунд (restoreForced)

Игрок может откатить игру к выбранному раунду (и шагу раунда) через меню — «Восстановить игру».

### Вызов с клиента

- В туториале/хелпере (lib/game/tutorial/restoreForced.js) задаётся шаг с формой: раунд и roundStep. При отправке вызывается **game.api.restoreForced** с параметрами `{ round, roundStep }`.

### api/restoreForced.js

- По `session.gameId` берётся текущая игра из store.
- В коллекции `game_dump` ищется снимок по `_gameid` и опционально `round`, `roundStep` (limit 1). Если снимка нет — ошибка.
- **Очистка текущей игры**: всем подписчикам канала игры отправляется «пустое» состояние (wrapPublishData(null)); очищаются локальные изменения игры (`clearChanges()`); вызывается **game.removeGame({ preventDeleteDumps: true })** — игра удаляется из памяти и из Redis, дампы в MongoDB не трогаются.
- **Загрузка из дампа**: вызывается **loadGame** с `query: { round, roundStep }` (или доменный аналог). Из dump поднимается состояние на выбранный раунд/шаг и вставляется в коллекцию `game`, создаётся новый экземпляр игры в памяти.
- **Повторное подключение участников**: по данным старой игры (до removeGame) обходятся `game.store.player` и `game.store.viewer`. Для каждого участника с `ready === true`: пользователь подписывается на канал игры, вызывается `restoredGame.playerJoin` или `restoredGame.viewerJoin`, для каждой сессии пользователя — подписка на канал игры (vue-store) и добавление onClose для отписки.

В итоге все игроки и зрители снова подключены к уже восстановленной на выбранный раунд игре.

---

## 4. Восстановление корпоративной игры (gameType: corporate)

Восстановление корпоративной игры (супер-игра с командами, gamesMap, roundPool) отличается от обычной: отдельный processData в loadGame, свой initPlayerWaitEvents и teamReady, ветка restoredPlayer в playerJoin, restoreForced только по round и рекурсивный removeGame по командам. Подробное описание: [Корпоративная игра](game-corporate.md).

---

## 5. Сводка по файлам и полям

| Что | Где |
|-----|-----|
| Сохранение снимка | `roundStart` → `dumpState()` → запись в `game_dump` |
| Загрузка из дампа | store `loadFromDB({ query, fromDump: true })` — поиск в `game_dump`, перенос в `game` |
| Восстановление после рестарта | `loadGame` (fromDump, restorationMode), лобби enter → restoreGame → `game.api.restore` |
| Флаг restorationMode | Игра и Redis-кэш; в initPlayerWaitEvents TRIGGER при restorationMode → restart() |
| Откат на раунд | `game.api.restoreForced` → removeGame (preventDeleteDumps) → loadGame с query → повторный join игроков/зрителей |
| Корпоративная игра | [Корпоративная игра](game-corporate.md) |
