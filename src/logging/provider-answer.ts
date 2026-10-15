type ErrorFields = Readonly<Record<string, unknown>>;

// The pinned WorkOS SDK gives these facts of an answer on its error or on a cause of it. None of them is a credential,
// and the request ID lets the provider find the answer. For an answer that is not JSON, the SDK keeps the status of the
// answer in rawStatus and gives 500 as its status.
const ANSWER_FACTS: readonly { readonly name: string; readonly fields: readonly string[] }[] = [
  { name: 'status', fields: ['rawStatus', 'status'] },
  { name: 'code', fields: ['code'] },
  { name: 'request ID', fields: ['requestID'] },
];
// Only a short token reaches the log, so that a value cannot add a line or a long text.
const ANSWER_TOKEN = /^[\w.:-]{1,100}$/;
const CAUSE_DEPTH = 5;

export function providerAnswerOf(cause: unknown): string {
  const chain = causeChainOf(cause);
  const facts = ANSWER_FACTS.flatMap(({ name, fields }) => {
    const value = firstTokenIn(chain, fields);
    return value === undefined ? [] : [`${name} ${value}`];
  });
  return facts.length === 0 ? '' : ` (${facts.join(', ')})`;
}

function causeChainOf(cause: unknown): readonly ErrorFields[] {
  const chain: ErrorFields[] = [];
  let current = cause;
  while (typeof current === 'object' && current !== null && chain.length < CAUSE_DEPTH) {
    const error = current as ErrorFields;
    chain.push(error);
    current = error.cause;
  }
  return chain;
}

function firstTokenIn(chain: readonly ErrorFields[], fields: readonly string[]): string | undefined {
  for (const error of chain) {
    for (const field of fields) {
      const value = error[field];
      if ((typeof value === 'string' || typeof value === 'number') && ANSWER_TOKEN.test(String(value))) return String(value);
    }
  }
  return undefined;
}
