// Russian message catalog. Typed against `Messages`, so it must mirror every
// key in en.ts (a missing key is a compile error). Interpolation placeholders
// like `{msg}` must be preserved verbatim.

import type { Messages } from './en'

export const ru: Messages = {
  common: {
    appName: 'Панель сервера Palworld',
    language: 'Язык',
    cancel: 'Отмена',
    save: 'Сохранить',
    close: 'Закрыть',
    confirm: 'Подтвердить',
    loading: 'Загрузка…',
  },
  login: {
    controlGrid: 'СЕТЬ УПРАВЛЕНИЯ PALWORLD',
    authRequired: 'ТРЕБУЕТСЯ АВТОРИЗАЦИЯ',
    bootTitle: 'ПОСЛЕДОВАТЕЛЬНОСТЬ ЗАГРУЗКИ',
    boot: {
      init: 'ИНИЦИАЛИЗАЦИЯ ИНТЕРФЕЙСА АДМИНИСТРАТОРА',
      loadProtocols: 'ЗАГРУЗКА ПРОТОКОЛОВ СВЯЗИ С СЕРВЕРОМ',
      verifyEndpoint: 'ПРОВЕРКА REST-ЭНДПОИНТА PALWORLD',
      monitorArmed: 'МОНИТОР ЖИВОЙ ПРОВЕРКИ АКТИВЕН',
      awaitingPassword: 'ОЖИДАНИЕ ПАРОЛЯ ОПЕРАТОРА',
      checking: 'ЖИВАЯ ПРОВЕРКА: ПРОВЕРЯЮ ПАРОЛЬ',
      verified: 'ЖИВАЯ ПРОВЕРКА: УСПЕХ. ДОСТУП ПОДТВЕРЖДЁН.',
      failed: 'ЖИВАЯ ПРОВЕРКА: ОШИБКА. {msg}',
    },
    adminTitle: 'Администрирование сервера Palworld',
    adminSubtitle: 'Аутентификация по REST',
    demoIntro: 'Включён демо-режим. Запустите демонстрационную панель без пароля сервера.',
    intro: 'Введите пароль оператора, чтобы вывести панель управления в онлайн.',
    passwordLabel: 'Пароль',
    passwordPlaceholder: 'Введите пароль',
    passwordPlaceholderDemo: 'Не требуется в демо-режиме',
    rememberMe: 'Запомнить меня',
    rememberMeHint: 'Сохранить пароль на этом устройстве.',
    rememberAria: 'Запомнить данные входа',
    validationPlaceholder: 'СТАТУС ПРОВЕРКИ',
    pressConnect: 'Нажмите «Подключиться» для авторизации.',
    connecting: 'Подключение…',
    launchDemo: 'Запустить демо',
    connectButton: 'Подключиться к серверу',
    mascotAlt: 'Маскот Pal',
    errPasswordRequired: 'Требуется пароль',
    errCouldNotVerify: 'Не удалось проверить пароль. Убедитесь, что сервер онлайн, и повторите попытку.',
    errAuthFailed: 'Ошибка аутентификации. Проверьте пароль и повторите попытку.',
    errUnreachable: 'Сейчас не удаётся связаться с сервером. Возможно, он офлайн — попробуйте чуть позже.',
    errTimeout: 'Истекло время ожидания соединения. Сервер может быть занят или офлайн; попробуйте снова.',
    errFailedConnect: 'Не удалось подключиться к серверу',
    errValidationTimeout: 'Время проверки истекло через {seconds} с.',
    errUnknown: 'Неизвестная ошибка',
  },
  header: {
    serverFallback: 'Сервер Palworld',
    status: {
      connected: 'подключено',
      checking: 'проверка',
      disconnected: 'отключено',
    },
    awaitingLink: 'Ожидание связи с сервером',
    addressTitle: 'Игра {game} · REST {rest}',
    tabDashboard: 'Панель',
    tabMap: 'Карта',
    docs: 'Доки',
    settingsAria: 'Настройки панели',
    theme: 'Тема',
    selected: 'Выбрано',
    roster: 'Игроки',
    disconnect: 'Отключиться',
  },
  dashboard: {
    overview: 'Обзор панели',
    map: {
      tactical: 'ТАКТИЧЕСКАЯ КАРТА',
      overlay: 'КАРТА МИРА АКТИВНА',
      tracked: 'НА КАРТЕ',
    },
  },
  "chat": {
    "unknown": "неизвестно",
    "kickPlayer": "Кикнуть игрока",
    "banPlayer": "Забанить игрока",
    "joined": "→ {name} зашёл",
    "left": "← {name} вышел",
    "sendFailed": "Не удалось отправить сообщение",
    "title": "Чат",
    "liveGameChat": "Игровой чат",
    "empty": "Сообщений пока нет. Здесь появятся сообщения игроков.",
    "messageAs": "Сообщение от имени {sender}…",
    "inputAria": "Сообщение в чат",
    "send": "Отправить"
  },
  "console": {
    "feed": "Лента консоли ({count})",
    "clear": "Очистить",
    "terminalTitle": "СИСТЕМНЫЙ ТЕРМИНАЛ",
    "noLogs": "ЛОГОВ ПОКА НЕТ. ОТВЕТЫ API ПОЯВЯТСЯ ЗДЕСЬ.",
    "opError": "{action}: {detail}",
    "genericOk": "{action}: OK",
    "unknownError": "Неизвестная ошибка",
    "op": {
      "info": { "name": "Информация о сервере", "ok": "Информация о сервере обновлена" },
      "settings": { "name": "Настройки сервера", "ok": "Настройки сервера получены" },
      "players": { "name": "Список игроков", "ok": "Список игроков обновлён" },
      "server-snapshot": { "name": "Снимок состояния", "ok": "Снимок: {fps} FPS, игроков {players}, история {samples}" },
      "announce": { "name": "Объявление", "ok": "Объявление отправлено игрокам" },
      "save": { "name": "Сохранение мира", "ok": "Мир сохранён" },
      "shutdown": { "name": "Выключение сервера", "ok": "Команда на выключение отправлена" },
      "stop": { "name": "Остановка сервера", "ok": "Команда на остановку отправлена" },
      "kick": { "name": "Кик игрока", "ok": "Игрок кикнут" },
      "ban": { "name": "Бан игрока", "ok": "Игрок забанен" },
      "unban": { "name": "Разбан игрока", "ok": "Игрок разбанен" }
    }
  },
  "mod": {
    "serverFallback": "Сервер Palworld",
    "tier": "Модератор",
    "docs": "Документация",
    "disconnect": "Отключиться",
    "searchPlaceholder": "Поиск игроков..."
  },
  "map": {
    "title": "Онлайн-карта V4",
    "description": "Прямой рендеринг изображения с живыми маркерами игроков из API `players`.",
    "tabDashboard": "Панель",
    "tabMap": "Карта",
    "layers": "Слои",
    "mapLayers": "Слои карты",
    "fastTravel": "Быстрое перемещение",
    "bossTowers": "Башни боссов",
    "players": "Игроки",
    "world": "Мир",
    "tree": "Древо",
    "cursor": "Курсор",
    "status": {
      "connected": "подключено",
      "checking": "проверка",
      "disconnected": "отключено"
    },
    "playersCount": "Игроки: {n}",
    "altWorld": "Карта мира Palworld",
    "altTree": "Карта Мирового Древа Palworld",
    "badge": "КАРТА V4",
    "loadingImage": "Загрузка изображения карты...",
    "imageFailed": "Не удалось загрузить изображение карты",
    "loadFailed": "Приложению не удалось загрузить",
    "refreshIdle": "Обновление: --",
    "refreshPaused": "Обновление: пауза",
    "refreshIn": "Обновление: {n} с"
  },
  "loginTransition": {
    "terminal": {
      "authAccepted": "ТОКЕН АВТОРИЗАЦИИ ПРИНЯТ",
      "targetUplink": "ЦЕЛЕВОЙ КАНАЛ ОПРЕДЕЛЁН :: {server}",
      "syncing": "СИНХРОНИЗАЦИЯ ПАНЕЛЕЙ УПРАВЛЕНИЯ",
      "warmingCache": "ПРОГРЕВ КЭША ЖИВЫХ МЕТРИК",
      "mounting": "МОНТИРОВАНИЕ КОМАНДНОЙ СЕТКИ",
      "title": "ЗАГРУЗКА СЕТКИ"
    },
    "secureUplink": "ЗАЩИЩЁННЫЙ КАНАЛ",
    "loginAccepted": "ПОСЛЕДОВАТЕЛЬНОСТЬ ВХОДА ПРИНЯТА",
    "gridReady": "СЕТКА ГОТОВА",
    "booting": "ЗАГРУЗКА",
    "handshake": "РУКОПОЖАТИЕ ПОСЛЕ ВХОДА",
    "routeOpen": "МАРШРУТ ОТКРЫТ",
    "routing": "МАРШРУТИЗАЦИЯ К КОМАНДНОМУ УЗЛУ",
    "operatorSync": "Синхронизация оператора",
    "identityLock": "Фиксация личности",
    "gridOperator": "Оператор сети",
    "adminDesignation": "Администратор Palworld",
    "linkIntegrity": "Целостность канала",
    "complete": "ЗАВЕРШЕНО",
    "synchronizing": "СИНХРОНИЗАЦИЯ",
    "markers": {
      "auth": "АВТ",
      "link": "СВЯЗЬ",
      "cache": "КЭШ",
      "grid": "СЕТКА"
    },
    "target": "Цель",
    "status": "Статус",
    "commandGridReady": "Командная сетка готова",
    "initializing": "Инициализация",
    "timelineStart": "00:00",
    "timelineEnd": "КОНЕЦ"
  },
  "players": {
    "joinedServer": "{name} зашёл на сервер",
    "leftServer": "{name} вышел с сервера",
    "searchPlaceholder": "Поиск игроков...",
    "autoNext": "Авто {s}с · далее через",
    "onlinePlayersCount": "Игроки онлайн ({n})",
    "noPlayersOnline": "Нет игроков онлайн",
    "noPlayersFound": "Игроки не найдены",
    "noMatchingPlayers": "Подходящие игроки не найдены",
    "watchlist": "Наблюдение",
    "bannedBadge": "БАН",
    "lvl": "Ур. {level}",
    "levelValue": "Уровень {level}",
    "fieldOperator": "Полевой оператор",
    "na": "Н/Д",
    "kick": "Кикнуть",
    "ban": "Забанить",
    "unban": "Разбанить",
    "kickPlayer": "Кикнуть игрока",
    "banPlayer": "Забанить игрока",
    "unbanPlayer": "Разбанить игрока",
    "actionKick": "кикнуть",
    "actionBan": "забанить",
    "confirmActionQuestion": "Вы уверены, что хотите {action} {name}?",
    "banReversible": "Это действие можно отменить, разбанив игрока.",
    "kicked": "{name} кикнут",
    "banned": "{name} забанен",
    "unbanned": "{name} разбанен",
    "failedKick": "Не удалось кикнуть {name}",
    "failedBan": "Не удалось забанить {name}",
    "failedUnban": "Не удалось разбанить {name}",
    "cannotKickMissingId": "Не удалось кикнуть {name}: отсутствует user ID",
    "cannotBanMissingId": "Не удалось забанить {name}: отсутствует user ID",
    "cannotUnbanMissingId": "Не удалось разбанить {name}: отсутствует user ID",
    "cannotKickThisPlayer": "Не удалось кикнуть игрока: отсутствует user ID",
    "cannotBanThisPlayer": "Не удалось забанить игрока: отсутствует user ID",
    "cannotUnbanThisPlayer": "Не удалось разбанить игрока: отсутствует user ID"
  },
  "serverControl": {
    "announce": {
      "title": "Объявления",
      "subtitle": "Канал вещания",
      "quickMessages": "Быстрые сообщения",
      "quickHint": "Нажмите, чтобы отправить мгновенно. Наведите на кнопку для предпросмотра сообщения.",
      "sendAria": "Отправить объявление: {message}",
      "sent": "Объявление отправлено",
      "sendFailed": "Не удалось отправить объявление",
      "groups": {
        "info": "Информация и статус",
        "events": "События и геймплей",
        "maintenance": "Обслуживание и предупреждения"
      },
      "presets": {
        "adminOnline": {
          "label": "Админ онлайн",
          "message": "Админ онлайн. Играйте честно!"
        },
        "rulesReminder": {
          "label": "Напоминание о правилах",
          "message": "Напоминание: будьте вежливы в чате и не портите игру другим."
        },
        "saveComplete": {
          "label": "Сохранение готово",
          "message": "Мир успешно сохранён."
        },
        "backupComplete": {
          "label": "Бэкап готов",
          "message": "✅ Резервное копирование завершено. Спасибо за терпение."
        },
        "restartComplete": {
          "label": "Перезапуск готов",
          "message": "✅ Перезапуск сервера завершён. С возвращением!"
        },
        "pvpSoon": {
          "label": "Скоро PvP-ивент",
          "message": "⚔ PvP-ивент начнётся через 5 минут. Снаряжайтесь и собирайтесь на базе!"
        },
        "serverFullSoon": {
          "label": "Скоро заполнится",
          "message": "На сервере много игроков. Слоты могут скоро закончиться."
        },
        "prepareToSave": {
          "label": "Подготовка к сохранению",
          "message": "Сохранение мира через 60 секунд. Избегайте рискованных действий."
        },
        "backupRunning": {
          "label": "Идёт бэкап",
          "message": "💾 Идёт резервное копирование. Возможны временные лаги."
        },
        "highLatency": {
          "label": "Высокий пинг",
          "message": "⚠ Обнаружен высокий пинг. Мы следим за производительностью сервера."
        },
        "maintenanceSoon": {
          "label": "Скоро обслуживание",
          "message": "Скоро начнётся техобслуживание. Сервер ненадолго отключится."
        },
        "adminMaintenance": {
          "label": "Обслуживание админки",
          "message": "Идёт обслуживание админ-инструментов. Некоторые действия могут выполняться с задержкой."
        }
      }
    },
    "management": {
      "title": "Управление сервером",
      "subtitle": "Командный мостик",
      "saveWorld": "Сохранить мир",
      "shutdown": "Выключить сервер",
      "forceStop": "Принудительная остановка",
      "start": "Включить сервер",
      "starting": "Запуск сервера…",
      "startInitiated": "Запуск сервера запущен",
      "startFailed": "Не удалось запустить сервер — настроена ли интеграция с хостом?",
      "offlineHint": "Сервер выключен",
      "shutdownAction": "Выключить",
      "shuttingDown": "Выключение...",
      "stopping": "Остановка...",
      "confirmShutdownTitle": "Выключить сервер",
      "confirmStopTitle": "Принудительная остановка сервера",
      "confirmShutdownDesc": "Мир будет сохранён, игроки получат объявление о выключении, через 10 секунд сервер выключится.",
      "confirmStopDesc": "Мир будет сохранён, игроки получат объявление об остановке, затем сервер будет немедленно остановлен.",
      "restart": {
        "heading": "Расписание перезапуска",
        "description": "Запуск перезапуска объявляет игрокам обратный отсчёт, затем выполняет корректное сохранение и перезапуск на хосте — сервер вернётся автоматически, вручную запускать не нужно. Нажмите «Отмена», чтобы прервать до срабатывания.",
        "nextReminder": "— следующее напоминание через",
        "scheduled": "Перезапуск запланирован — сервер вернётся автоматически",
        "scheduleFailedIntegration": "Не удалось запланировать перезапуск — настроена ли интеграция с хостом сервера?",
        "scheduleFailed": "Не удалось запланировать перезапуск",
        "cancelled": "Расписание отменено",
        "cancelledNotified": "Перезапуск отменён — игроки уведомлены",
        "cancelFailed": "Не удалось отправить запрос на отмену",
        "presets": {
          "min1": {
            "label": "⚠ Перезапуск через 1 мин",
            "message": "⚠ Сервер перезапустится через 1 минуту. Найдите безопасное место!"
          },
          "min5": {
            "label": "⚠ Перезапуск через 5 мин",
            "message": "⚠ Сервер перезапустится через 5 минут."
          },
          "min10": {
            "label": "⚠ Перезапуск через 10 мин",
            "message": "⚠ Сервер перезапустится через 10 минут."
          }
        },
        "reminders": {
          "min5": "⚠ Перезапуск сервера через 5 минут.",
          "min4": "⚠ Перезапуск сервера через 4 минуты.",
          "min3": "⚠ Перезапуск сервера через 3 минуты.",
          "min2": "⚠ Перезапуск сервера через 2 минуты.",
          "min2excl": "⚠ Перезапуск сервера через 2 минуты!",
          "min1": "⚠ Перезапуск сервера через 1 минуту!",
          "sec30": "⚠ Перезапуск сервера через 30 секунд!",
          "sec10": "⚠ Перезапуск сервера через 10 секунд!"
        }
      },
      "announce": {
        "worldSaved": "Мир успешно сохранён.",
        "shutdownSoon": "⚠ Сервер выключится через 10 секунд!",
        "forceStopping": "⚠ Сервер принудительно останавливается!"
      },
      "toast": {
        "worldSaved": "Мир успешно сохранён",
        "saveFailed": "Не удалось сохранить мир",
        "shutdownAnnounced": "Выключение объявлено — ожидание 10 секунд...",
        "shutdownInitiated": "Выключение сервера запущено",
        "shutdownFailed": "Не удалось выключить сервер",
        "stopped": "Сервер остановлен",
        "stopFailed": "Не удалось остановить сервер"
      }
    },
    "ban": {
      "title": "Управление банами",
      "subtitle": "Журнал санкций",
      "bannedPlayers": "Забаненные игроки ({count})",
      "noBanned": "Забаненных игроков нет 🎉",
      "unban": "Разбанить",
      "unbanned": "Игрок разбанен",
      "unbanFailed": "Не удалось разбанить игрока"
    },
    "metrics": {
      "title": "Метрики",
      "subtitle": "Производительность в реальном времени",
      "serverFps": "FPS сервера",
      "live": "Сейчас",
      "now": "Сейчас",
      "na": "Н/Д",
      "refreshEvery": "Обновление · каждые {seconds} с",
      "hourHistory": "История за 1 час",
      "awaitingSamples": "Ожидание данных метрик",
      "min": "Мин",
      "avg": "Сред",
      "max": "Макс",
      "median": "Медиана",
      "longestDip": "Просадка <45",
      "under30": "Ниже 30",
      "medianTip": "Структурное здоровье: плато, на котором реально работает сервер. Если оно уходит от базовой линии, постоянная нагрузка симуляции выросла — вот сигнал, который важен.",
      "longestDipTip": "Самый долгий непрерывный отрезок ниже 45 FPS за этот час (с учётом пропусков). Всплески ~30 с — нормальные скачки симуляции; провалы 60–90 с и дольше означают проблемы.",
      "under30Tip": "Доля последнего часа, проведённая ниже 30 FPS (бюджет всплесков). После ~10% игроки это чувствуют.",
      "frameTime": "Время кадра",
      "uptime": "Аптайм",
      "worldDay": "День мира",
      "bases": "Базы",
      "players": "Игроки",
      "health": {
        "noData": "Нет данных",
        "noDataDetail": "Пока нет образцов FPS — сэмплер запускается или сервер недоступен.",
        "stale": "Устарело",
        "staleDetail": "Последний образец в кольце старше 5 минут — сэмплер или сервер недоступен; вердикт не выносится, чтобы не гадать.",
        "calibrating": "Калибровка",
        "calibratingDetail": "Сбор данных кольца ({count}/{total} образцов) — вердикт через ~5 минут.",
        "excellent": "Отлично",
        "good": "Хорошо",
        "fair": "Нормально",
        "degraded": "Снижено",
        "critical": "Критично",
        "detail": "Здоровье {score}/100 — медиана за час {hourMedian} ({medianComp}), медиана за 10 мин {recentMedian} ({recentComp}), среднее {avg} ({avgComp}), ниже 30 {under30}% ({budgetComp}), самый долгий <45 {longestDip} ({dipComp}). Ограничивает: {limiting}.",
        "capEntry": "{name} (лимит {cap})",
        "none": "нет",
        "caps": {
          "min1med10": "медиана за 1 мин < 10",
          "min1med15": "медиана за 1 мин < 15",
          "min10med25": "медиана за 10 мин < 25",
          "min10med30": "медиана за 10 мин < 30",
          "min10med45": "медиана за 10 мин < 45",
          "hourMed30": "медиана за час < 30",
          "hourMed45": "медиана за час < 45",
          "budget25": "бюджет ниже 30 > 25%",
          "budget10": "бюджет ниже 30 > 10%",
          "dip3m": "просадка > 3 мин",
          "dip90s": "просадка > 90 с"
        }
      }
    },
    "settings": {
      "title": "Настройки",
      "subtitle": "Снимок конфигурации",
      "description": "Описание",
      "noDescription": "Нет описания",
      "worldGuid": "GUID мира",
      "unknown": "Неизвестно",
      "search": "Поиск настроек",
      "searchPlaceholder": "Поиск по ключу или значению...",
      "noResults": "По вашему запросу ничего не найдено."
    }
  },
  "settings": {
    "title": "Настройки панели",
    "description": "Управление учётными данными для входа в саму панель. Они отдельны от игрового сервера.",
    "adminPasswordSection": "Пароль админа",
    "currentPassword": "Текущий пароль",
    "newPassword": "Новый пароль",
    "confirmNewPassword": "Подтвердите новый пароль",
    "changeAdminPassword": "Сменить пароль админа",
    "modAccessSection": "Доступ модератора",
    "enabled": "Включён",
    "disabled": "Отключён",
    "modAccessDescription": "Второй вход, который может кикать и банить игроков и смотреть список игроков, но не более.",
    "newModPassword": "Новый пароль модератора",
    "modPassword": "Пароль модератора",
    "updatePassword": "Обновить пароль",
    "enableModAccess": "Включить доступ модератора",
    "disable": "Отключить",
    "newPasswordMinLength": "Новый пароль должен содержать не менее {min} символов",
    "passwordsMismatch": "Новые пароли не совпадают",
    "changePasswordFailed": "Не удалось сменить пароль",
    "adminPasswordChanged": "Пароль админа изменён",
    "modPasswordMinLength": "Пароль модератора должен содержать не менее {min} символов",
    "updateModAccessFailed": "Не удалось обновить доступ модератора",
    "modAccessDisabled": "Доступ модератора отключён",
    "modPasswordUpdated": "Пароль модератора обновлён",
    "modAccessEnabled": "Доступ модератора включён"
  },
  "playerActions": {
    "kickMissingUserId": "Не удалось кикнуть {name}: отсутствует ID пользователя",
    "kicked": "{name} кикнут",
    "kickFailed": "Не удалось кикнуть {name}",
    "banMissingUserId": "Не удалось забанить {name}: отсутствует ID пользователя",
    "banned": "{name} забанен",
    "banFailed": "Не удалось забанить {name}",
    "unbanMissingUserId": "Не удалось разбанить {name}: отсутствует ID пользователя",
    "unbanned": "{name} разбанен",
    "unbanFailed": "Не удалось разбанить {name}",
    "kickTitle": "Кикнуть игрока",
    "banTitle": "Забанить игрока",
    "confirmKick": "Вы уверены, что хотите кикнуть {name}?",
    "confirmBan": "Вы уверены, что хотите забанить {name}? Это действие можно отменить, разбанив игрока.",
    "kick": "Кикнуть",
    "ban": "Забанить"
  }
}
