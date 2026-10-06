// firebase/auth's TypeScript entry point resolves to the web build, which
// doesn't declare getReactNativePersistence. Metro resolves the React Native
// build at runtime, where it does exist, so declare it here for lib/firebase.ts.
import type { Persistence } from 'firebase/auth';

declare module 'firebase/auth' {
  interface ReactNativeAsyncStorage {
    setItem(key: string, value: string): Promise<void>;
    getItem(key: string): Promise<string | null>;
    removeItem(key: string): Promise<void>;
  }
  export function getReactNativePersistence(storage: ReactNativeAsyncStorage): Persistence;
}
