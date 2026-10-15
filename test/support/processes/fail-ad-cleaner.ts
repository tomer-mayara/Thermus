import adblockRust from 'adblock-rs';
import { nativeFailureMarker } from './server-preloads.ts';

// Loaded with --import before the server, this module makes the native parser fail for each rule list, as a defect
// in adblock-rs can. The server shares this module instance, because Node loads a package one time per process.
adblockRust.FilterSet.prototype.addFilters = () => {
  throw new Error(nativeFailureMarker);
};
