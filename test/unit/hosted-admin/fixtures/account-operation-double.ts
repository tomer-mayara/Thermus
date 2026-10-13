import type { RequestContext } from '../../../../src/auth/access-context.ts';
import type { AccountOperation } from '../../../../src/hosted-admin/account-routes.ts';

export interface OperationCall {
  readonly request: Request;
  readonly context: RequestContext;
}

// Test only: a protected account operation that records each call and answers with the context that it got.
export class AccountOperationDouble {
  readonly calls: OperationCall[] = [];

  readonly operation: AccountOperation = async (request, context) => {
    this.calls.push({ request, context });
    return Response.json({ path: new URL(request.url).pathname, context }, { headers: { 'X-Operation': 'account-operation-double' } });
  };
}
