import { selectAll, selectOne } from 'css-select';
import { DomUtils, parseDocument } from 'htmlparser2';
import type { WebsiteFetcher } from '../website-fetcher/website-fetcher.ts';
import type { SearchDocument, SearchEngine } from './search-engine.ts';

type HtmlDocument = ReturnType<typeof parseDocument>;
type HtmlNode = HtmlDocument | HtmlDocument['children'][number];
type HtmlElement = Extract<HtmlDocument['children'][number], { attribs: unknown }>;

export class SearchEngineBraveHttp implements SearchEngine {
  private static readonly MAX_HTML_BYTES = 10 * 1024 * 1024;
  private static readonly MAX_ELEMENT_DEPTH = 256;

  constructor(private readonly fetcher: WebsiteFetcher) {}

  async search(query: string, signal: AbortSignal): Promise<SearchDocument> {
    signal.throwIfAborted();
    const url = new URL('https://search.brave.com/search');
    url.search = new URLSearchParams({ q: query }).toString();
    let page;
    try {
      page = await this.fetcher.fetchURL(url.href, signal);
    } catch (error) {
      signal.throwIfAborted();
      throw error;
    }
    signal.throwIfAborted();
    try {
      this.assertFinalUrl(page.finalUrl);
      if (Buffer.byteLength(page.html, 'utf8') > SearchEngineBraveHttp.MAX_HTML_BYTES) throw new Error('Search failed');
      const document = parseDocument(page.html);
      signal.throwIfAborted();
      this.assertDepth(document, signal);
      const kind = this.classify(document);
      signal.throwIfAborted();
      return { page, kind };
    } catch {
      signal.throwIfAborted();
      throw new Error('Search failed');
    }
  }

  private assertFinalUrl(value: string): void {
    const url = new URL(value);
    if (url.origin !== 'https://search.brave.com' || url.pathname !== '/search'
      || url.username !== '' || url.password !== '') throw new Error('Search failed');
  }

  private assertDepth(document: HtmlDocument, signal: AbortSignal): void {
    const pending: { node: HtmlNode; depth: number }[] = [{ node: document, depth: 0 }];
    for (let current = pending.pop(); current !== undefined; current = pending.pop()) {
      signal.throwIfAborted();
      const { node } = current;
      const depth = current.depth + (node.type === 'tag' || node.type === 'script' || node.type === 'style' ? 1 : 0);
      if (depth > SearchEngineBraveHttp.MAX_ELEMENT_DEPTH) throw new Error('Search failed');
      if ('children' in node) {
        for (let index = node.children.length - 1; index >= 0; index--) pending.push({ node: node.children[index], depth });
      }
    }
  }

  private classify(document: HtmlDocument): SearchDocument['kind'] {
    const searchPages = selectAll<HtmlNode, HtmlElement>('main#search-page', document);
    if (searchPages.length !== 1) throw new Error('Search failed');
    const searchPage = searchPages[0];
    const sections = selectAll<HtmlNode, HtmlElement>('section#mixed-main', searchPage);
    if (sections.length !== 1) throw new Error('Search failed');
    const main = sections[0];
    const banners = selectAll<HtmlNode, HtmlElement>('#bad-results-info-banner', searchPage);
    if (banners.length !== 0) {
      if (banners.length === 1 && this.isNoResults(main, searchPage, banners[0])) return 'no_results';
      throw new Error('Search failed');
    }
    const results = selectAll<HtmlNode, HtmlElement>('.snippet[data-type="web"]', main);
    if (results.length === 0 || !results.every((result) => this.isWebResult(result))) throw new Error('Search failed');
    return 'results';
  }

  private isWebResult(result: HtmlElement): boolean {
    const title = selectOne<HtmlNode, HtmlElement>('.result-content > a.l1[href] > .title.search-snippet-title', result);
    const content = selectOne<HtmlNode, HtmlElement>('.generic-snippet .content, '
      + '.result-content > .video-snippet[data-macro="video"] > .content > .desktop-default-regular.line-clamp-2', result);
    const link = title?.parent;
    const href = link && 'attribs' in link ? link.attribs.href : undefined;
    return Boolean(title && DomUtils.textContent(title).trim() && href?.trim() && content && DomUtils.textContent(content).trim());
  }

  private isNoResults(main: HtmlElement, searchPage: HtmlElement, banner: HtmlElement): boolean {
    const wrapper = selectOne<HtmlNode, HtmlElement>(':scope > .fallback-snippet', main);
    if (wrapper === null || banner.parent !== wrapper) return false;
    if (selectOne<HtmlNode, HtmlElement>('.snippet, .result-content, a.l1, .search-snippet-title, [data-type]', searchPage) !== null) return false;
    const headers = selectAll<HtmlNode, HtmlElement>(':scope > span', banner);
    if (headers.length !== 1) return false;
    const header = headers[0];
    const lists = selectAll<HtmlNode, HtmlElement>(':scope > ul', banner);
    if (lists.length !== 1) return false;
    const queries = selectAll<HtmlNode, HtmlElement>(':scope > span', header);
    const tips = selectAll<HtmlNode, HtmlElement>(':scope > li', lists[0]);
    if (queries.length !== 1 || !DomUtils.textContent(queries[0]).trim() || tips.length !== 2) return false;
    for (const [parent, children] of [[main, [wrapper]], [wrapper, [banner]], [banner, [header, lists[0]]], [lists[0], tips]] as const) {
      const meaningful = parent.children.filter((node) => node.type !== 'comment' && (node.type !== 'text' || node.data.trim() !== ''));
      if (meaningful.length !== children.length || !meaningful.every((node, index) => node === children[index])) return false;
    }
    const expected = [header, queries[0], lists[0], ...tips];
    const descendants = selectAll<HtmlNode, HtmlElement>('*', banner);
    if (descendants.length !== expected.length) return false;
    const label = header.children.filter((node) => node.type === 'text').map((node) => node.data).join('').trim();
    return label === 'Not many great matches came back for your search:'
      && DomUtils.textContent(tips[0]).trim() === 'Try more general keywords'
      && DomUtils.textContent(tips[1]).trim() === 'Try fewer keywords';
  }
}
