declare module 'adblock-rs' {
  export interface CosmeticResources {
    hide_selectors: string[];
    procedural_actions: string[];
    exceptions: string[];
    injected_script: string;
    generichide: boolean;
  }

  export class FilterSet {
    public constructor(debug: boolean);
    public addFilters(rules: string): unknown;
  }

  export class Engine {
    public constructor(filterSet: FilterSet);
    public urlCosmeticResources(url: string): CosmeticResources;
    public hiddenClassIdSelectors(
      classes: string[],
      ids: string[],
      exceptions: string[],
    ): string[];
  }

  const adblockRust: {
    FilterSet: typeof FilterSet;
    Engine: typeof Engine;
  };

  export default adblockRust;
}
