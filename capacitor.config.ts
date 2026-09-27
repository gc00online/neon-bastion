import type { CapacitorConfig } from '@capacitor/cli';

// appId 는 스토어에 등록된 고유 ID (2026-09 애플 등록). 바꾸면 다른 앱으로 취급되므로 변경 금지.
const config: CapacitorConfig = {
  appId: 'com.gc00.neonbastion',
  appName: 'Neon Bastion',
  webDir: 'dist',
  backgroundColor: '#070912',
  ios: {
    contentInset: 'never',
  },
  android: {
    backgroundColor: '#070912',
  },
};

export default config;
