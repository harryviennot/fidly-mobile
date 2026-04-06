import { ConfigContext, ExpoConfig } from "expo/config";


const IS_DEV = process.env.APP_VARIANT === 'development';
const IS_PREVIEW = process.env.APP_VARIANT === 'preview';

// Google OAuth iOS Client IDs per environment
// const GOOGLE_IOS_CLIENT_IDS = {
//   development: '576860647918-nm7ghog299kfj4dirlln5a7s7dotto95',
//   preview: '576860647918-hf9vfimbv7bnenvtcgeecepeub1lko1p',
//   production: '576860647918-qn7ok48tfb5q2iopjb56pf1mqcp3s109',
// };

// const getGoogleIosClientId = () => {
//   if (IS_DEV) {
//     return GOOGLE_IOS_CLIENT_IDS.development;
//   }
//   if (IS_PREVIEW) {
//     return GOOGLE_IOS_CLIENT_IDS.preview;
//   }
//   return GOOGLE_IOS_CLIENT_IDS.production;
// };

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
  version: "1.0.2",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "stampeo-scanner",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: getUniqueIdentifier(),
    icon: "./assets/stampeo.icon",
    // usesAppleSignIn: true,
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
    // "expo-apple-authentication",
    // [
    //   "@react-native-google-signin/google-signin",
    //   {
    //     iosUrlScheme: `com.googleusercontent.apps.${getGoogleIosClientId()}`
    //   }
    // ],
    // [
    //   "expo-notifications",
    //   {
    //     color: "#334d43",
    //     sounds: []
    //   }
    // ]
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true
  },
  extra: {
    router: {
      "root": "./src/app"
    },
    // googleIosClientId: `${getGoogleIosClientId()}.apps.googleusercontent.com`,
    appVariant: process.env.APP_VARIANT || 'production',
    eas: {
      projectId: "90b8f436-1de4-47ba-ad18-c897db0ab688"
    }
  },
  owner: "harrys-expo-org"
})