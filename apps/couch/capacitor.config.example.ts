/**
 * Example Capacitor config for wrapping Horse Pocket into a native Android APK/AAB.
 * To enable later:
 *   npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/push-notifications
 *   cp capacitor.config.example.ts capacitor.config.ts
 *   npm run build && npx cap add android && npx cap sync
 */
const config = {
  appId: 'com.horsepocket.app',
  appName: 'Horse Pocket',
  webDir: 'www',
  server: {
    androidScheme: 'https',
  },
};

export default config;
