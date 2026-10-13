import { AccessDeniedError, requirePermission } from '../../src/auth/access-context.ts';
import type { AccountOperation } from '../../src/hosted-admin/account-routes.ts';

export interface AccountWork {
  readonly path: string;
  readonly subject: string;
  readonly tenantId: string;
  readonly organizationId?: string;
}

// Test only: protected account, organization, and billing operations. Each checks its permission in the trusted
// context, records its work there, and answers with that context. Production registers no such operation.
export class AccountOperationProbe {
  readonly work: AccountWork[] = [];
  private readonly permissions: ReadonlyMap<string, string>;

  constructor(permissions: ReadonlyMap<string, string>) {
    this.permissions = permissions;
  }

  readonly operation: AccountOperation = async (request, context) => {
    const path = new URL(request.url).pathname;
    const permission = this.permissions.get(path);
    if (permission === undefined) return new Response('Not Found', { status: 404 });
    try {
      requirePermission(context, permission);
    } catch (error) {
      if (error instanceof AccessDeniedError) return Response.json({ refused: error.reason }, { status: 403 });
      throw error;
    }
    const { user, tenantId, organizationId } = context;
    this.work.push({ path, subject: user.subject, tenantId, ...(organizationId === undefined ? {} : { organizationId }) });
    return Response.json({ context });
  };
}
