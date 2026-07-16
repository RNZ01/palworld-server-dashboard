// English message catalog. This is the source-of-truth shape: every other
// locale (see ru.ts) is typed against `Messages`, so a missing key is a
// compile error. Keep keys grouped by screen/feature. Interpolation uses
// `{param}` placeholders resolved by the `t()` helper in i18n-context.tsx.

export const en = {
  common: {
    appName: 'Palworld Server Dashboard',
    language: 'Language',
    cancel: 'Cancel',
    save: 'Save',
    close: 'Close',
    confirm: 'Confirm',
    loading: 'Loading…',
  },
  login: {
    controlGrid: 'PALWORLD CONTROL GRID',
    authRequired: 'AUTHENTICATION REQUIRED',
    bootTitle: 'BOOT SEQUENCE',
    boot: {
      init: 'INITIALIZING ADMIN INTERFACE',
      loadProtocols: 'LOADING SERVER LINK PROTOCOLS',
      verifyEndpoint: 'VERIFY PALWORLD REST ENDPOINT',
      monitorArmed: 'LIVE VALIDATION MONITOR ARMED',
      awaitingPassword: 'AWAITING OPERATOR PASSWORD',
      checking: 'LIVE VALIDATION: CHECKING PASSWORD',
      verified: 'LIVE VALIDATION: PASS. CREDENTIALS VERIFIED.',
      failed: 'LIVE VALIDATION: FAILED. {msg}',
    },
    adminTitle: 'Palworld Server Admin',
    adminSubtitle: 'REST Link Authentication',
    demoIntro: 'Demo mode is enabled. Launch the sample dashboard without a server password.',
    intro: 'Enter your operator password to bring the control grid online.',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Enter your password',
    passwordPlaceholderDemo: 'Not required in demo mode',
    rememberMe: 'Remember me',
    rememberMeHint: 'Save your password on this device.',
    rememberAria: 'Remember login data',
    validationPlaceholder: 'VALIDATION STATUS PLACEHOLDER',
    pressConnect: 'Press connect to authenticate.',
    connecting: 'Connecting…',
    launchDemo: 'Launch Demo',
    connectButton: 'Connect to Server',
    mascotAlt: 'Pal mascot',
    errPasswordRequired: 'Password is required',
    errCouldNotVerify: 'Could not verify your password. Make sure the server is online and try again.',
    errAuthFailed: 'Authentication failed. Check your password and try again.',
    errUnreachable: 'Cannot reach the server right now. It may be offline — try again shortly.',
    errTimeout: 'The connection timed out. The server may be busy or offline; try again.',
    errFailedConnect: 'Failed to connect to server',
    errValidationTimeout: 'Validation timed out after {seconds} seconds.',
    errUnknown: 'Unknown error',
  },
  header: {
    serverFallback: 'Palworld Server',
    status: {
      connected: 'connected',
      checking: 'checking',
      disconnected: 'disconnected',
    },
    awaitingLink: 'Awaiting Server Link',
    addressTitle: 'Game {game} · REST {rest}',
    tabDashboard: 'Dashboard',
    tabMap: 'Live Map',
    docs: 'Docs',
    settingsAria: 'Panel settings',
    theme: 'Theme',
    selected: 'Selected',
    roster: 'Roster',
    disconnect: 'Disconnect',
  },
  dashboard: {
    overview: 'Dashboard Overview',
    map: {
      tactical: 'TACTICAL MAP',
      overlay: 'WORLD OVERLAY ACTIVE',
      tracked: 'TRACKED',
    },
  },
  "chat": {
    "unknown": "unknown",
    "kickPlayer": "Kick Player",
    "banPlayer": "Ban Player",
    "joined": "→ {name} joined",
    "left": "← {name} left",
    "sendFailed": "Failed to send message",
    "title": "Chat",
    "liveGameChat": "Live Game Chat",
    "empty": "No chat yet. Player messages will appear here.",
    "messageAs": "Message as {sender}…",
    "inputAria": "Chat message",
    "send": "Send"
  },
  "console": {
    "feed": "Console Feed ({count})",
    "clear": "Clear",
    "terminalTitle": "SYSTEM TERMINAL",
    "noLogs": "NO LOGS YET. API RESPONSES WILL APPEAR HERE.",
    "opError": "{action}: {detail}",
    "genericOk": "{action}: OK",
    "unknownError": "Unknown error",
    "op": {
      "info": { "name": "Server info", "ok": "Server info updated" },
      "settings": { "name": "Server settings", "ok": "Server settings loaded" },
      "players": { "name": "Player list", "ok": "Player list refreshed" },
      "server-snapshot": { "name": "State snapshot", "ok": "Snapshot: {fps} FPS, {players} players, {samples} history samples" },
      "announce": { "name": "Broadcast", "ok": "Announcement sent to players" },
      "save": { "name": "World save", "ok": "World saved" },
      "shutdown": { "name": "Server shutdown", "ok": "Shutdown command sent" },
      "stop": { "name": "Server stop", "ok": "Stop command sent" },
      "kick": { "name": "Kick player", "ok": "Player kicked" },
      "ban": { "name": "Ban player", "ok": "Player banned" },
      "unban": { "name": "Unban player", "ok": "Player unbanned" }
    }
  },
  "mod": {
    "serverFallback": "Palworld Server",
    "tier": "Mod",
    "docs": "Docs",
    "disconnect": "Disconnect",
    "searchPlaceholder": "Search players..."
  },
  "map": {
    "title": "Live Map V4",
    "description": "Direct image renderer with live player markers from the `players` API.",
    "tabDashboard": "Dashboard",
    "tabMap": "Live Map",
    "layers": "Layers",
    "mapLayers": "Map Layers",
    "fastTravel": "Fast Travel",
    "bossTowers": "Boss Towers",
    "players": "Players",
    "world": "World",
    "tree": "Tree",
    "cursor": "Cursor",
    "status": {
      "connected": "connected",
      "checking": "checking",
      "disconnected": "disconnected"
    },
    "playersCount": "Players: {n}",
    "altWorld": "Palworld world map",
    "altTree": "Palworld World Tree map",
    "badge": "MAP V4",
    "loadingImage": "Loading map image...",
    "imageFailed": "Map image failed to load",
    "loadFailed": "The app could not load",
    "refreshIdle": "Refresh: --",
    "refreshPaused": "Refresh: Paused",
    "refreshIn": "Refresh: {n}s"
  },
  "loginTransition": {
    "terminal": {
      "authAccepted": "AUTH TOKEN ACCEPTED",
      "targetUplink": "TARGET UPLINK RESOLVED :: {server}",
      "syncing": "SYNCING CONTROL SURFACES",
      "warmingCache": "WARMING LIVE METRICS CACHE",
      "mounting": "MOUNTING COMMAND GRID",
      "title": "GRID BOOTSTRAP"
    },
    "secureUplink": "SECURE UPLINK",
    "loginAccepted": "LOGIN SEQUENCE ACCEPTED",
    "gridReady": "GRID READY",
    "booting": "BOOTING",
    "handshake": "POST-LOGIN HANDSHAKE",
    "routeOpen": "ROUTE OPEN",
    "routing": "ROUTING TO COMMAND NEXUS",
    "operatorSync": "Operator Sync",
    "identityLock": "Identity Lock",
    "gridOperator": "Grid Operator",
    "adminDesignation": "Palworld Admin",
    "linkIntegrity": "Link Integrity",
    "complete": "COMPLETE",
    "synchronizing": "SYNCHRONIZING",
    "markers": {
      "auth": "AUTH",
      "link": "LINK",
      "cache": "CACHE",
      "grid": "GRID"
    },
    "target": "Target",
    "status": "Status",
    "commandGridReady": "Command Grid Ready",
    "initializing": "Initializing",
    "timelineStart": "00:00",
    "timelineEnd": "END"
  },
  "players": {
    "joinedServer": "{name} joined the server",
    "leftServer": "{name} left the server",
    "searchPlaceholder": "Search players...",
    "autoNext": "Auto {s}s · next in",
    "onlinePlayersCount": "Online Players ({n})",
    "noPlayersOnline": "No players online",
    "noPlayersFound": "No players found",
    "noMatchingPlayers": "No matching players found",
    "watchlist": "Watchlist",
    "bannedBadge": "BANNED",
    "lvl": "Lvl {level}",
    "levelValue": "Level {level}",
    "fieldOperator": "Field Operator",
    "na": "N/A",
    "kick": "Kick",
    "ban": "Ban",
    "unban": "Unban",
    "kickPlayer": "Kick Player",
    "banPlayer": "Ban Player",
    "unbanPlayer": "Unban Player",
    "actionKick": "kick",
    "actionBan": "ban",
    "confirmActionQuestion": "Are you sure you want to {action} {name}?",
    "banReversible": "This action can be reversed by unbanning the player.",
    "kicked": "Kicked {name}",
    "banned": "Banned {name}",
    "unbanned": "Unbanned {name}",
    "failedKick": "Failed to kick {name}",
    "failedBan": "Failed to ban {name}",
    "failedUnban": "Failed to unban {name}",
    "cannotKickMissingId": "Cannot kick {name}: missing user ID",
    "cannotBanMissingId": "Cannot ban {name}: missing user ID",
    "cannotUnbanMissingId": "Cannot unban {name}: missing user ID",
    "cannotKickThisPlayer": "Cannot kick this player: missing user ID",
    "cannotBanThisPlayer": "Cannot ban this player: missing user ID",
    "cannotUnbanThisPlayer": "Cannot unban this player: missing user ID"
  },
  "serverControl": {
    "announce": {
      "title": "Announcements",
      "subtitle": "Broadcast Channel",
      "quickMessages": "Quick Messages",
      "quickHint": "Click to broadcast instantly. Hover a button to preview the exact message.",
      "sendAria": "Send announcement: {message}",
      "sent": "Announcement sent",
      "sendFailed": "Failed to send announcement",
      "groups": {
        "info": "Info & Status",
        "events": "Events & Gameplay",
        "maintenance": "Maintenance & Warnings"
      },
      "presets": {
        "adminOnline": {
          "label": "Admin online",
          "message": "An admin is online. Play fair!"
        },
        "rulesReminder": {
          "label": "Rules reminder",
          "message": "Reminder: Keep chat respectful and avoid griefing."
        },
        "saveComplete": {
          "label": "Save complete",
          "message": "World has been saved successfully."
        },
        "backupComplete": {
          "label": "Backup complete",
          "message": "✅ Backup complete. Thank you for your patience."
        },
        "restartComplete": {
          "label": "Restart complete",
          "message": "✅ Server restart complete. Welcome back!"
        },
        "pvpSoon": {
          "label": "PvP event soon",
          "message": "⚔ PvP event starts in 5 minutes. Gear up and meet at base!"
        },
        "serverFullSoon": {
          "label": "Server full soon",
          "message": "Server population is high. Slots may fill up soon."
        },
        "prepareToSave": {
          "label": "Prepare to save",
          "message": "Saving world in 60 seconds. Please avoid risky actions."
        },
        "backupRunning": {
          "label": "Backup running",
          "message": "💾 Backup is now running. Temporary lag may occur."
        },
        "highLatency": {
          "label": "High latency",
          "message": "⚠ High latency detected. We are monitoring server performance."
        },
        "maintenanceSoon": {
          "label": "Maintenance soon",
          "message": "Maintenance starting soon. Server will go offline briefly."
        },
        "adminMaintenance": {
          "label": "Admin maintenance",
          "message": "Admin tools maintenance in progress. Some actions may be delayed."
        }
      }
    },
    "management": {
      "title": "Server Management",
      "subtitle": "Command Deck",
      "saveWorld": "Save World",
      "shutdown": "Shutdown Server",
      "forceStop": "Force Stop",
      "start": "Start Server",
      "starting": "Starting server…",
      "startInitiated": "Server start requested",
      "startFailed": "Failed to start server — is the host integration set up?",
      "offlineHint": "Server is offline",
      "shutdownAction": "Shutdown",
      "shuttingDown": "Shutting down...",
      "stopping": "Stopping...",
      "confirmShutdownTitle": "Shutdown Server",
      "confirmStopTitle": "Force Stop Server",
      "confirmShutdownDesc": "This will save the world, announce shutdown, wait 10 seconds, then shutdown the server.",
      "confirmStopDesc": "This will save the world, announce the stop, then immediately stop the server.",
      "restart": {
        "heading": "Restart Schedules",
        "description": "Triggering a restart announces a countdown to players, then performs a graceful save-and-restart on the host — the server comes back automatically, no manual start needed. Hit Cancel to abort before it fires.",
        "nextReminder": "— next reminder in",
        "scheduled": "Restart scheduled — the server will come back automatically",
        "scheduleFailedIntegration": "Failed to schedule restart — is the server host integration set up?",
        "scheduleFailed": "Failed to schedule restart",
        "cancelled": "Schedule cancelled",
        "cancelledNotified": "Restart cancelled — players notified",
        "cancelFailed": "Cancel request failed to send",
        "presets": {
          "min1": {
            "label": "⚠ Restart in 1 min",
            "message": "⚠ Server will restart in 1 minute. Please find a safe spot!"
          },
          "min5": {
            "label": "⚠ Restart in 5 min",
            "message": "⚠ Server will restart in 5 minutes."
          },
          "min10": {
            "label": "⚠ Restart in 10 min",
            "message": "⚠ Server will restart in 10 minutes."
          }
        },
        "reminders": {
          "min5": "⚠ Server restarting in 5 minutes.",
          "min4": "⚠ Server restarting in 4 minutes.",
          "min3": "⚠ Server restarting in 3 minutes.",
          "min2": "⚠ Server restarting in 2 minutes.",
          "min2excl": "⚠ Server restarting in 2 minutes!",
          "min1": "⚠ Server restarting in 1 minute!",
          "sec30": "⚠ Server restarting in 30 seconds!",
          "sec10": "⚠ Server restarting in 10 seconds!"
        }
      },
      "announce": {
        "worldSaved": "World has been saved successfully.",
        "shutdownSoon": "⚠ Server will shutdown in 10 seconds!",
        "forceStopping": "⚠ Server force stopping now!"
      },
      "toast": {
        "worldSaved": "World saved successfully",
        "saveFailed": "Failed to save world",
        "shutdownAnnounced": "Shutdown announced - waiting 10 seconds...",
        "shutdownInitiated": "Server shutdown initiated",
        "shutdownFailed": "Failed to shutdown server",
        "stopped": "Server stopped",
        "stopFailed": "Failed to stop server"
      }
    },
    "ban": {
      "title": "Ban Management",
      "subtitle": "Sanctions Ledger",
      "bannedPlayers": "Banned Players ({count})",
      "noBanned": "No banned players 🎉",
      "unban": "Unban",
      "unbanned": "Player unbanned",
      "unbanFailed": "Failed to unban player"
    },
    "metrics": {
      "title": "Metrics",
      "subtitle": "Live Performance",
      "serverFps": "Server FPS",
      "live": "Live",
      "now": "Now",
      "na": "N/A",
      "refreshEvery": "Refresh · every {seconds}s",
      "hourHistory": "1 Hour History",
      "awaitingSamples": "Awaiting Metrics Samples",
      "min": "Min",
      "avg": "Avg",
      "max": "Max",
      "median": "Median",
      "longestDip": "Longest <45",
      "under30": "Under 30",
      "medianTip": "Structural health: the plateau the server actually runs at. If this slides off baseline, standing sim load has grown — that's the signal that matters.",
      "longestDipTip": "Longest continuous stretch below 45 FPS this hour (gap-aware). ~30s bursts are normal sim spikes; 60-90s+ valleys mean trouble.",
      "under30Tip": "Share of the last hour spent below 30 FPS (the burst budget). Past ~10% players feel it.",
      "frameTime": "Frame Time",
      "uptime": "Uptime",
      "worldDay": "World Day",
      "bases": "Bases",
      "players": "Players",
      "health": {
        "noData": "No Data",
        "noDataDetail": "No FPS samples yet — sampler starting or server down.",
        "stale": "Stale",
        "staleDetail": "Newest ring sample is over 5 minutes old — sampler or server down; verdict withheld rather than guessed.",
        "calibrating": "Calibrating",
        "calibratingDetail": "Collecting ring data ({count}/{total} samples) — verdict after ~5 minutes.",
        "excellent": "Excellent",
        "good": "Good",
        "fair": "Fair",
        "degraded": "Degraded",
        "critical": "Critical",
        "detail": "Health {score}/100 — hour median {hourMedian} ({medianComp}), 10-min median {recentMedian} ({recentComp}), avg {avg} ({avgComp}), under-30 {under30}% ({budgetComp}), longest <45 {longestDip} ({dipComp}). Limiting: {limiting}.",
        "capEntry": "{name} (cap {cap})",
        "none": "none",
        "caps": {
          "min1med10": "1-min median < 10",
          "min1med15": "1-min median < 15",
          "min10med25": "10-min median < 25",
          "min10med30": "10-min median < 30",
          "min10med45": "10-min median < 45",
          "hourMed30": "hour median < 30",
          "hourMed45": "hour median < 45",
          "budget25": "under-30 budget > 25%",
          "budget10": "under-30 budget > 10%",
          "dip3m": "longest dip > 3m",
          "dip90s": "longest dip > 90s"
        }
      }
    },
    "settings": {
      "title": "Settings",
      "subtitle": "Configuration Snapshot",
      "description": "Description",
      "noDescription": "No description",
      "worldGuid": "World GUID",
      "unknown": "Unknown",
      "search": "Search Settings",
      "searchPlaceholder": "Search by key or value...",
      "noResults": "No settings matched your search."
    }
  },
  "settings": {
    "title": "Panel Settings",
    "description": "Manage the panel's own login credentials. These are separate from the game server.",
    "adminPasswordSection": "Admin Password",
    "currentPassword": "Current password",
    "newPassword": "New password",
    "confirmNewPassword": "Confirm new password",
    "changeAdminPassword": "Change admin password",
    "modAccessSection": "Mod Access",
    "enabled": "Enabled",
    "disabled": "Disabled",
    "modAccessDescription": "A second login that can kick/ban players and view the roster, but nothing else.",
    "newModPassword": "New mod password",
    "modPassword": "Mod password",
    "updatePassword": "Update password",
    "enableModAccess": "Enable mod access",
    "disable": "Disable",
    "newPasswordMinLength": "New password must be at least {min} characters",
    "passwordsMismatch": "New passwords do not match",
    "changePasswordFailed": "Failed to change password",
    "adminPasswordChanged": "Admin password changed",
    "modPasswordMinLength": "Mod password must be at least {min} characters",
    "updateModAccessFailed": "Failed to update mod access",
    "modAccessDisabled": "Mod access disabled",
    "modPasswordUpdated": "Mod password updated",
    "modAccessEnabled": "Mod access enabled"
  },
  "playerActions": {
    "kickMissingUserId": "Cannot kick {name}: missing user ID",
    "kicked": "Kicked {name}",
    "kickFailed": "Failed to kick {name}",
    "banMissingUserId": "Cannot ban {name}: missing user ID",
    "banned": "Banned {name}",
    "banFailed": "Failed to ban {name}",
    "unbanMissingUserId": "Cannot unban {name}: missing user ID",
    "unbanned": "Unbanned {name}",
    "unbanFailed": "Failed to unban {name}",
    "kickTitle": "Kick Player",
    "banTitle": "Ban Player",
    "confirmKick": "Are you sure you want to kick {name}?",
    "confirmBan": "Are you sure you want to ban {name}? This action can be reversed by unbanning the player.",
    "kick": "Kick",
    "ban": "Ban"
  }
} as const

// Recursively turn every string leaf of the `en` shape into a plain `string`,
// so other locales must supply the same keys but with their own text.
type DeepStringShape<T> = {
  readonly [K in keyof T]: T[K] extends string ? string : DeepStringShape<T[K]>
}

export type Messages = DeepStringShape<typeof en>
