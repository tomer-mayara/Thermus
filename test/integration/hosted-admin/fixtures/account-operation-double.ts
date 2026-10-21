import type { RequestContext } from '../../../../src/accounts/identity/access-context.ts';
import type { AccountOperation } from '../../../../src/interfaces/web/account/account-routes.ts';

export interface OperationCall {
  readonly request: Request;
  readonly context: RequestContext;
}

export type OperationAnswer = (request: Request, context: RequestContext) => Promise<Response>;

async function contextAnswer(request: Request, context: RequestContext): Promise<Response> {
  return Response.json({ path: new URL(request.url).pathname, context }, { headers: { 'X-Operation': 'account-operation-double' } });
}

export class AccountOperationDouble {
  readonly calls: OperationCall[] = [];
  private readonly answer: OperationAnswer;

  constructor(answer: OperationAnswer = contextAnswer) {
    this.answer = answer;
  }

  readonly operation: AccountOperation = async (request, context) => {
    this.calls.push({ request, context });
    return this.answer(request, context);
  };
}
