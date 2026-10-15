// The auth WorkOS MCP URL fetch work slice: the hosted edition with the real WorkOS provider and the fetch tool.
// Step 1 of the plan: this stub lets the build pass. The acceptance test fails at run time until step 4 implements it.
import type { Application, ApplicationLogger, RouteConfig } from '../../../../src/application.ts';
import type { WorkOSConnection } from '../../../../src/hosted-workos-application.ts';

type Environment = Readonly<Record<string, string | undefined>>;

export interface WorkSliceParts {
  readonly config: RouteConfig;
  readonly connection: WorkOSConnection;
  readonly environment: Environment;
}

export async function composeWorkSliceApplication(_parts: WorkSliceParts, _logger: ApplicationLogger): Promise<Application> {
  throw new Error('The work slice composition is not implemented yet');
}
