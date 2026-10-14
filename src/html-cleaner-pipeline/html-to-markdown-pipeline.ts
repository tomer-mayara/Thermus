import { type WebsiteFetchResult } from '../website-fetcher/website-fetcher.ts';

export type Ctx = WebsiteFetchResult & {
  markdown?: string;
  title?: string | null;
  // Accumulated ad targets and independent hidden HTML targets or comments removed.
  removed: number;
  // Accumulated unsupported or unapplied ad work attempts.
  skipped: number;
  // Detection categories in first-seen order, without duplicates. Count with Set.size.
  found?: readonly string[];
  warnings?: readonly string[];
};

export interface Step {
  invoke(ctx: Ctx): Promise<Ctx>;
}

export class HtmlToMarkdownPipeline {
  public constructor(private readonly steps: readonly Step[]) {}

  public async process(page: WebsiteFetchResult, signal?: AbortSignal): Promise<Ctx> {
    let ctx: Ctx = { ...page, removed: 0, skipped: 0 };
    for (const step of this.steps) {
      signal?.throwIfAborted();
      ctx = await step.invoke(ctx);
    }
    signal?.throwIfAborted();
    return ctx;
  }
}
