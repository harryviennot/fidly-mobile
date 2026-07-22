import { ConfigContext, ExpoConfig } from "expo/config";


const IS_DEV = process.env.APP_VARIANT === 'development';
const IS_PREVIEW = process.env.APP_VARIANT === 'preview';

// Google OAuth iOS Client IDs per environment (raw IDs without the .apps.googleusercontent.com suffix,
// used to build the iOS reversed URL scheme below).
const GOOGLE_IOS_CLIENT_IDS = {
  development: '697360742144-uvt8crdjvh3qpbm0kqlnai27n4qrnef5',
  preview: '697360742144-e3k0tsrgokgejokt867lc9q2uk6nvq2j',
  production: '697360742144-bchjmu7c1vphnvg057ir8a606et5csup',
};

const GOOGLE_WEB_CLIENT_ID = '697360742144-qc1frui0nd27bc8hke7rb3vls2u8fnhe.apps.googleusercontent.com';

const getGoogleIosClientId = () => {
  if (IS_DEV) return GOOGLE_IOS_CLIENT_IDS.development;
  if (IS_PREVIEW) return GOOGLE_IOS_CLIENT_IDS.preview;
  return GOOGLE_IOS_CLIENT_IDS.production;
};

const getUniqueIdentifier = () => {
  if (IS_DEV) {
    return 'com.hryvnt.stampeo.dev';
  }

  if (IS_PREVIEW) {
    return 'com.hryvnt.stampeo.preview';
  }

  return 'com.hryvnt.stampeo';
};

const getAppName = () => {
  if (IS_DEV) {
    return 'Stampeo (Dev)';
  }

  if (IS_PREVIEW) {
    return 'Stampeo (Preview)';
  }

  return 'Stampeo';
};



export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: getAppName(),
  slug: "stampeo-scanner",
  version: "2.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "stampeo-scanner",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: getUniqueIdentifier(),
    icon: "./assets/stampeo.icon",
    usesAppleSignIn: true,
    infoPlist: {
      NSCameraUsageDescription: "This app needs camera access to scan customer loyalty card QR codes",
      ITSAppUsesNonExemptEncryption: false
    },
    config: {
      usesNonExemptEncryption: false
    }
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png"
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: getUniqueIdentifier(),
    permissions: [
      "android.permission.RECORD_AUDIO",
      "android.permission.CAMERA",
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.ACCESS_COARSE_LOCATION",
    ]
  },
  web: {
    output: "static",
    favicon: "./assets/images/favicon.png"
  },
  plugins: [
    [
      "expo-router",
      {
        "root": "./src/app"
      }
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 100,
        resizeMode: "contain",
        backgroundColor: "#f0efe9",
        dark: {
          backgroundColor: "#f0efe9"
        }
      }
    ],
    [
      "expo-camera",
      {
        "cameraPermission": "Allow $(PRODUCT_NAME) to access your camera to scan QR codes."
      }
    ],
    [
      "expo-location",
      {
        "locationWhenInUsePermission": "Stampeo uses your location only on your device to confirm you're at the right store before stamping. It never leaves your phone, and we never receive, store, or share it."
      }
    ],
    "expo-apple-authentication",
    [
      "@react-native-google-signin/google-signin",
      {
        iosUrlScheme: `com.googleusercontent.apps.${getGoogleIosClientId()}`
      }
    ],
    "expo-web-browser",
    [
      // AppCheckCore (pulled in via GoogleSignIn) became a Swift pod and now requires
      // its GoogleUtilities/RecaptchaInterop deps to emit module maps, otherwise CocoaPods
      // refuses to integrate it as a static library and `pod install` fails on EAS.
      // We don't commit Podfile.lock (ios/ is a generated, gitignored folder), so EAS
      // re-resolves pods on every build — this keeps the fix across prebuilds.
      "expo-build-properties",
      {
        ios: {
          extraPods: [
            { name: "GoogleUtilities", modular_headers: true },
            { name: "RecaptchaInterop", modular_headers: true },
          ],
        },
      },
    ],
    [
      "@sentry/react-native/expo",
      {
        organization: "stampeo",
        project: "scanner-app",
        url: "https://sentry.io/"
      }
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true
  },
  extra: {
    router: {
      "root": "./src/app"
    },
    googleIosClientId: `${getGoogleIosClientId()}.apps.googleusercontent.com`,
    googleWebClientId: GOOGLE_WEB_CLIENT_ID,
    appVariant: process.env.APP_VARIANT || 'production',
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    eas: {
      projectId: "90b8f436-1de4-47ba-ad18-c897db0ab688"
    }
  },
  owner: "harrys-expo-org"
})
