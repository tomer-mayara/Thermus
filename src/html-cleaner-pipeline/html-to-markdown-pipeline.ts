export type Ctx = {
  url: string;
  html: string;
  markdown?: string;
  title?: string | null;
  removed: number;
  skipped: number;
};

export interface Step {
  invoke(ctx: Ctx): Promise<Ctx>;
}

export class HtmlToMarkdownPipeline {
  public constructor(private readonly steps: readonly Step[]) {}

  public async process(url: string, html: string): Promise<Ctx> {
    let ctx: Ctx = { url, html, removed: 0, skipped: 0 };
    for (const step of this.steps) {
      ctx = await step.invoke(ctx);
    }
    return ctx;
  }
}
