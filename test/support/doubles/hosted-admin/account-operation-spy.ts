import { AccessDeniedError, requirePermission } from '../../../../src/auth/access-context.ts';
import type { AccountOperation } from '../../../../src/hosted-admin/account-routes.ts';

interface AccountWork {
  readonly path: string;
  readonly subject: string;
  readonly tenantId: string;
  readonly organizationId?: string;
}

export class AccountOperationSpy {
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
