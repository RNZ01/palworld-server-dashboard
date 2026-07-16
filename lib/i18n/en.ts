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
} as const

// Recursively turn every string leaf of the `en` shape into a plain `string`,
// so other locales must supply the same keys but with their own text.
type DeepStringShape<T> = {
  readonly [K in keyof T]: T[K] extends string ? string : DeepStringShape<T[K]>
}

export type Messages = DeepStringShape<typeof en>
