import { Platform } from 'react-native';
import Constants from 'expo-constants';

const DEV_API_URL = Platform.select({
  android: 'http://10.0.2.2:8000/api/v1',
  ios: 'http://localhost:8000/api/v1',
  default: 'http://localhost:8000/api/v1',
});

const PROD_API_URL =
  Constants.expoConfig?.extra?.apiUrl ?? 'https://your-production-url.com/api/v1';

export const API_BASE = __DEV__ ? DEV_API_URL : PROD_API_URL;
