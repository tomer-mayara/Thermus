export class SearchQuery {
  static readonly MAX_SCALARS = 512;
  readonly #value: string;

  constructor(value: unknown) {
    if (!SearchQuery.isValid(value)) throw new TypeError('Invalid search query');
    this.#value = value;
  }

  get value(): string {
    return this.#value;
  }

  private static isValid(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    let length = 0;
    for (const _scalar of value) {
      length += 1;
      if (length > SearchQuery.MAX_SCALARS) return false;
    }
    return value.isWellFormed() && /\S/u.test(value);
  }
}
