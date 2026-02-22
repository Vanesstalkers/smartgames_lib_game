# lib/game

Базовая модель игры, API игры, объекты (игрок, карта, колода, зритель) и общий фронт страницы игры.

## Структура

### Ядро

- **class.js** — базовый класс `Game`: наследует `lib.store.class`, хранит store, playerMap, обработчики событий, broadcast. Поддерживает игроков, карты, колоды, раунды, сохранение/загрузку.
- **GameObject.js** — базовый класс игровых объектов (общая логика для сущностей внутри игры).
- **GameEvent.js** — базовый класс игровых событий.
- **User.js** — пользователь в контексте игры (привязка к игре, joinGame, сессии).
- **Session.js** — сессия в контексте игры.
- **flush.js**, **endGameException.js** — вспомогательная логика.

### API (`api/`)

- **action.js** — вызов методов игры с клиента (RPC-подобный слой).
- **join.js** — подключение к игре (игрок/зритель).
- **enter.js** — вход на страницу игры (проверка участия, подписки).
- **leave.js** — выход из игры.
- **new.js** — создание новой игры.
- **restore.js**, **restoreForced.js** — восстановление игры.
- **cards.js** — работа с картами.
- **showLogs.js** — показ логов.

### Объекты (`_objects/`)

- **Player.js**, **Card.js**, **Deck.js**, **Viewer.js** — классы сущностей, используемые в базовой игре и переопределяемые в domain.

### Действия (`actions/`)

- **loadGame.js**, **endGame.js**, **roundStart.js**, **roundEnd.js**, **roundSteps.js**, **startGame.js**
- **addPlayer.js**, **initPlayerWaitEvents.js**, **initGameProcessEvents.js**
- **takeCard.js**, **playCard.js**, **eventTrigger.js**, **eventReset.js**
- **getFilledGamesConfigs.js**
- **broadcastRules/lobbySub.js** — правила рассылки для лобби.

### События (`events/`)

- **common/** — общие события (gameProcess и др.).

### Декораторы (`decorators/`)

- **@hasDeck.js** — добавление колоды в игру.

### Фронт (`front/`)

- **Game.vue** — базовая страница игры.
- **gameGlobals.mjs**, **gameEvents.mjs**, **gameMouseEvents.mjs** — глобалы и обработчики событий для клиента.
- **router.mjs** — маршруты игры.
- **components/card.vue** — базовый компонент карты.

### Туториалы (`tutorial/`)

- **links.js**, **getHelperLinks.js**, **restoreForced.js**, **gamePlane.js**, **gameControls.js**, **finished.js** — шаги и логика туториала игры.

## Связи

- Доменные игры (например, `domain/game/corporate`) наследуют или используют `lib.game` и переопределяют actions, events и фронт.

Подробное описание жизненного цикла игры (создание, join/enter, ожидание игроков, раунды, действия с клиента, события, сохранение и рассылка, завершение) вынесено в отдельный документ: [Процесс игры с точки зрения кода](docs/game-process.md). Восстановление после рестарта и откат на раунд: [Механизм восстановления игры](docs/game-restoration.md); для корпоративной игры — [Корпоративная игра](docs/game-corporate.md).

