import assert from 'node:assert/strict';
import type { Page } from 'playwright';

export async function adminShellMeasurements(page: Page, options: { readonly javaScriptEnabled: boolean; readonly width: number }) {
  const title = await page.getByRole('heading', { name: /^Members · \d+$/ }).evaluate(element => {
    const view = element.ownerDocument.defaultView;
    if (view === null) throw new Error('The Members title has no browser window');
    const style = view.getComputedStyle(element);
    return { size: style.fontSize, family: style.fontFamily };
  });
  const main = await page.getByRole('main').boundingBox();
  const list = await page.getByRole('region', { name: 'Active members', exact: true }).boundingBox();
  assert.ok(main, 'The Members content must be visible');
  assert.ok(list, 'The member list must be visible');
  const focus = await page.getByRole('link', { name: 'Skip to content', exact: true }).evaluate(element => {
    const view = element.ownerDocument.defaultView;
    if (view === null) throw new Error('The skip link has no browser window');
    const style = view.getComputedStyle(element);
    return { outline: style.outlineWidth, outlineColor: style.outlineColor, text: style.color, background: style.backgroundColor };
  });
  const text = await page.locator('body').evaluate(element => {
    const view = element.ownerDocument.defaultView;
    if (view === null) throw new Error('The page body has no browser window');
    const style = view.getComputedStyle(element);
    return { color: style.color, background: style.backgroundColor, family: style.fontFamily, sansLoaded: element.ownerDocument.fonts.check('17px "IBM Plex Sans"'), serifLoaded: element.ownerDocument.fonts.check('500 32px "IBM Plex Serif"') };
  });
  const navigation = await page.getByRole('banner').locator('a').evaluateAll(elements => elements.map(element => {
    const view = element.ownerDocument.defaultView;
    if (view === null) throw new Error('A header link has no browser window');
    const style = view.getComputedStyle(element);
    const bounds = element.getBoundingClientRect();
    return { name: element.textContent, font: style.fontFamily, size: style.fontSize, color: style.color, border: style.borderBottomColor, width: bounds.width, height: bounds.height, x: bounds.x, y: bounds.y };
  }));
  const surface = await page.getByRole('region', { name: 'Active members', exact: true }).evaluate(element => {
    const view = element.ownerDocument.defaultView;
    if (view === null) throw new Error('The member list has no browser window');
    const style = view.getComputedStyle(element);
    return { color: style.color, background: style.backgroundColor, border: style.borderColor };
  });
  return { ...options, title, main, list, focus, text, navigation, surface };
}
