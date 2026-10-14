import { chromium, type Browser, type Page } from 'playwright';

const actionTimeout = 30_000;

// One headless Chromium for the run. Each sign-in gets its own browser context, so it has its own AuthKit cookies.
export class LiveBrowser {
  readonly #preflight: () => Promise<void>;
  #browser: Promise<Browser> | undefined;

  constructor(preflight: () => Promise<void>) {
    this.#preflight = preflight;
  }

  async newPage(): Promise<Page> {
    this.#browser ??= this.#launch();
    const context = await (await this.#browser).newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    page.setDefaultTimeout(actionTimeout);
    return page;
  }

  async close(): Promise<void> {
    const browser = await this.#browser?.catch(() => undefined);
    await browser?.close();
  }

  async #launch(): Promise<Browser> {
    // Chromium does not use the network of Node. A Node request first makes a run without network fail before a browser starts.
    await this.#preflight();
    return chromium.launch({ headless: true });
  }
}
