import 'i18next';
import type enCommon from './en/common.json';
import type enLogin from './en/login.json';
import type enBusinesses from './en/businesses.json';
import type enLobby from './en/lobby.json';
import type enScanner from './en/scanner.json';
import type enStamp from './en/stamp.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof enCommon;
      login: typeof enLogin;
      businesses: typeof enBusinesses;
      lobby: typeof enLobby;
      scanner: typeof enScanner;
      stamp: typeof enStamp;
    };
  }
}
