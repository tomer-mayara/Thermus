import { type WebsiteFetchResult } from '../website-fetcher/website-fetcher.ts';

export type Ctx = WebsiteFetchResult & {
  markdown?: string;
  title?: string | null;
  removed: number;
  skipped: number;
  found?: readonly string[];
  warnings?: readonly string[];
};

export interface Step {
  invoke(ctx: Ctx): Promise<Ctx>;
}

export class HtmlToMarkdownPipeline {
  public constructor(private readonly steps: readonly Step[]) {}

  public async process(page: WebsiteFetchResult): Promise<Ctx> {
    let ctx: Ctx = { ...page, removed: 0, skipped: 0 };
    for (const step of this.steps) {
      ctx = await step.invoke(ctx);
    }
    return ctx;
  }
}
