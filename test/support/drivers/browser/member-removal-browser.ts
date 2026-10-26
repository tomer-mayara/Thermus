import type { TestContext } from 'node:test';
import { chromium, type Locator, type Page } from 'playwright';
import type { BrowserTransport } from './hosted-browser.ts';
import { serveBrowserTransport } from '../../in-process/browser-transport-site.ts';

export async function memberRemovalBrowser(t: TestContext, transport: BrowserTransport, options: { readonly cookieHeader: string; readonly javaScriptEnabled?: boolean }) {
  const port = await serveBrowserTransport(t, transport);
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, args: [`--host-resolver-rules=MAP thermus.example 127.0.0.1:${port}`, '--no-proxy-server'] });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: options.javaScriptEnabled, ignoreHTTPSErrors: true });
  await context.addCookies(options.cookieHeader.split(';').map(part => {
    const index = part.indexOf('=');
    return { name: part.slice(0, index).trim(), value: part.slice(index + 1).trim(), url: 'https://thermus.example', secure: true };
  }));
  const page = await context.newPage();
  page.setDefaultTimeout(3_000);
  return page;
}

export async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let count = 0; count < 35; count += 1) {
    await page.keyboard.press('Tab');
    if (await target.evaluate(element => element.matches(':focus'))) return;
  }
  throw new Error('The removal control was not reachable with Tab');
}
