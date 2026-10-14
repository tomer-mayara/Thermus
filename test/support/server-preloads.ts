import type { ServerSettings } from './server-process.ts';

// The server and command processes get only the settings of their test, so NODE_OPTIONS can load a test module
// into them before the program starts.
export function withPreload(settings: ServerSettings, preload: string): ServerSettings {
  return { ...settings, NODE_OPTIONS: `--import=${preload}` };
}

// This preload makes the native rule parser of adblock-rs fail. The message of the failure is private: a test
// checks that the server does not show it.
export const failingAdCleaner = new URL('./fail-ad-cleaner.js', import.meta.url).href;
export const nativeFailureMarker = 'private-native-marker';
