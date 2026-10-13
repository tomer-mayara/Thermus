import {} from '../website-fetcher/website-fetcher.js';
export class HtmlToMarkdownPipeline {
    steps;
    constructor(steps) {
        this.steps = steps;
    }
    async process(page) {
        let ctx = { ...page, removed: 0, skipped: 0 };
        for (const step of this.steps) {
            ctx = await step.invoke(ctx);
        }
        return ctx;
    }
}
//# sourceMappingURL=html-to-markdown-pipeline.js.map