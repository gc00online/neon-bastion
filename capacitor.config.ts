import type { CapacitorConfig } from '@capacitor/cli';

// appId 는 스토어에 올릴 고유 ID. 출시 전에 본인 도메인/이름으로 바꾸세요. (예: com.홍길동.neonbastion → 영문만 가능)
const config: CapacitorConfig = {
  appId: 'com.neonbastion.game',
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
