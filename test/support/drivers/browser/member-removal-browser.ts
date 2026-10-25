import type { TestContext } from 'node:test';
import { chromium, type Locator, type Page } from 'playwright';
import type { BrowserTransport } from './hosted-browser.ts';

export async function memberRemovalBrowser(t: TestContext, transport: BrowserTransport, cookieHeader: string) {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addCookies(cookieHeader.split(';').map(part => {
    const index = part.indexOf('=');
    return { name: part.slice(0, index).trim(), value: part.slice(index + 1).trim(), url: 'https://thermus.example', secure: true };
  }));
  await context.route('https://thermus.example/**', async route => {
    const incoming = route.request();
    const response = await transport(new Request(incoming.url(), {
      method: incoming.method(), headers: await incoming.allHeaders(),
      ...(incoming.postData() === null ? {} : { body: incoming.postData() }),
    }));
    await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
  });
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
