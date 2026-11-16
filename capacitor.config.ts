import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.maintenancemanager.app',
  appName: 'Maintenance Manager',
  webDir: 'out',
  android: {
    // match the dark app background while the WebView boots
    backgroundColor: '#0b211b',
  },
}

export default config
