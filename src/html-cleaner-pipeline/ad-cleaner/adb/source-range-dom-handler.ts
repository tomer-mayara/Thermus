import { DomHandler, type Parser } from 'htmlparser2';

export class SourceRangeDomHandler extends DomHandler {
  private sourceParser: Parser | undefined;

  public override onparserinit(parser: Parser): void {
    super.onparserinit(parser);
    this.sourceParser = parser;
  }

  public override onclosetag(_name?: string, isImplied?: boolean): void {
    const node = this.tagStack.at(-1);
    const parser = this.sourceParser;
    super.onclosetag();
    if (isImplied !== true || node === undefined || parser === undefined) {
      return;
    }
    const closesAtOwnOpeningTag = node.startIndex === parser.startIndex;
    if (!closesAtOwnOpeningTag) {
      node.endIndex = parser.startIndex - 1;
    }
  }
}
