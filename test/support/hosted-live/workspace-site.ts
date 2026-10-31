import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import type { Application } from '../../../src/app/application.ts';
import { composeWorkOSApplication, openWorkOSConnection } from '../../../src/app/hosted-workos-application.ts';
import { openLoggingStorage, type HostedLoggingStorage } from '../../../src/app/logging-storage.ts';
import { gatewayStartOf } from '../../../src/app/mcp-gateway-composition.ts';
import { startTenantProvisioning, tenantPlatformOf, type TenantProvisioning } from '../../../src/app/tenant-provisioning.ts';
import type { SystemLog } from '../../../src/logs/system/system-logger.ts';
import { loadDeploymentConfig } from '../../../src/runtime/config/deployment-config.ts';
import { loadTenantProvisioningSettings } from '../../../src/runtime/config/mcp-tenants-config.ts';
import { platformResumeOf } from '../../../src/tenancy/tenants/tenant-resume.ts';
import { RenderFake } from '../doubles/render/render-fake.ts';
import { controlPlaneTenantSettingsOf } from '../fixtures/control-plane-tenants.ts';
import { signupDocuments } from '../fixtures/signup-documents.ts';
import { postgresSettingsSite } from '../in-process/postgres-settings-site.ts';
import { LocalHttpsSite } from './local-https-site.ts';
import { browserRedirectUri, localOrigin, type HostedLiveSettings } from './settings.ts';

type Environment = Readonly<Record<string, string>>;

const organizationIdPattern = /^org_[0-9A-Z]+$/;

// The control plane of the SO-07 scenario of the hosted live gate (answer 1 of 27 October 2026): the hosted composition
// with WorkOS Staging, open signup with the test documents, MCP_TENANTS_ENABLED on, and the tenant registry on a
// disposable PostgreSQL with verified TLS, as the removal proof uses it. The provisioner loop starts only when the case
// asks, and its Render adapter reaches only an in-process fake of the Render API: the gate makes no Render call. The
// SO-06 live interface test and the SO-12 rehearsal prove the real Render path. The tenant sweeps of SO-09 do not start:
// the scenario needs none, and the organization sweep would read the organizations of WorkOS Staging.
export class WorkspaceSite {
  readonly render: RenderFake;
  readonly #settings: HostedLiveSettings;
  readonly #tenantSettings = controlPlaneTenantSettingsOf();
  #database: Awaited<ReturnType<typeof postgresSettingsSite>> | undefined;
  #environment: Environment | undefined;
  #startProvisioning: (() => void) | undefined;

  constructor(settings: HostedLiveSettings) {
    this.#settings = settings;
    const { render } = loadTenantProvisioningSettings(this.#tenantSettings);
    this.render = new RenderFake({ apiKey: render.apiKey, ownerId: render.ownerId });
  }

  // The disposable PostgreSQL with the thermus_admin migrations. Its cleanup runs with the other cleanup of the case, in
  // the order of registration, so the case registers the end of its run first.
  async openDatabase(t: TestContext): Promise<void> {
    const database = await postgresSettingsSite(t);
    const directory = await mkdtemp(join(tmpdir(), 'thermus-workspace-live-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const caPath = join(directory, 'ca.pem');
    await writeFile(caPath, database.connection.ca);
    this.#database = database;
    this.#environment = {
      DEPLOYMENT: 'hosted',
      PUBLIC_BASE_URL: `${localOrigin}/`,
      WORKOS_API_KEY: this.#settings.apiKey,
      WORKOS_CLIENT_ID: this.#settings.clientId,
      WORKOS_AUTHKIT_ISSUER: this.#settings.authkitIssuer,
      WORKOS_REDIRECT_URI: browserRedirectUri,
      WORKOS_COOKIE_PASSWORD: randomBytes(32).toString('base64url'),
      DATABASE_URL: database.connection.connectionString,
      DATABASE_CA_CERT_PATH: caPath,
      LOGGING_DESTINATION_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
      FREE_TENANT_LIMIT: '5',
      ...this.#tenantSettings,
    };
  }

  // The local HTTPS site at the registered origin, in front of the control plane.
  site(): Promise<LocalHttpsSite> {
    return LocalHttpsSite.start(this.#settings, { application: (logger) => this.#application(logger) });
  }

  // The provisioner loop, as app starts it with MCP_TENANTS_ENABLED on, with the Render fake at its fetch.
  startProvisioning(): void {
    assert.ok(this.#startProvisioning, 'The control plane must run before its provisioner starts.');
    this.#startProvisioning();
  }

  // Reads the row of the organization each second until it has the state, at most for the time limit.
  async untilState(organizationId: string, state: string, timeoutMs: number): Promise<void> {
    const deadline = performance.now() + timeoutMs;
    for (let seen = await this.stateOf(organizationId); seen !== state; seen = await this.stateOf(organizationId)) {
      assert.ok(performance.now() < deadline, `The row of ${organizationId} did not reach ${state}; it is ${String(seen)}.`);
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }

  // The state of the registry row of an organization, read by the owner of the database; undefined without a row.
  async stateOf(organizationId: string): Promise<string | undefined> {
    assert.match(organizationId, organizationIdPattern);
    assert.ok(this.#database, 'The database must run before a registry read.');
    const state = await this.#database.ownerQuery(`SELECT state FROM thermus_admin.tenants WHERE organization_id = '${organizationId}'`);
    return state === '' ? undefined : state;
  }

  async #application(logger: SystemLog): Promise<Application> {
    const environment = this.#environment;
    assert.ok(environment, 'The database must run before the control plane starts.');
    const config = loadDeploymentConfig(environment, 'http');
    const gateway = gatewayStartOf(environment);
    const provisioningSettings = loadTenantProvisioningSettings(environment);
    gateway.requireSigningKeyIn(provisioningSettings.gatewayPublicKey);
    const opened = await openLoggingStorage(environment, logger, gateway.freeTenantLimit);
    assert.ok(opened?.tenants, 'The control plane needs the tenant registry of the disposable PostgreSQL.');
    const registry = opened.tenants;
    let provisioning: TenantProvisioning | undefined;
    this.#startProvisioning = () => {
      provisioning ??= startTenantProvisioning({
        settings: provisioningSettings, publicBaseUrl: config.publicBaseUrl, authkitIssuer: this.#settings.authkitIssuer,
        store: registry.provisioning, logger, fetch: this.render.fetch,
      });
    };
    // The loop closes before the shared SQL runtime, as withTenantProvisioning closes it with the sweeps.
    const storage: HostedLoggingStorage = { ...opened, close: async () => { await provisioning?.close(); await opened.close(); } };
    // The resume of the gateway on the Render fake, as withTenantProvisioning composes it on the adapter of the sweeps.
    const resume = platformResumeOf(tenantPlatformOf({ settings: provisioningSettings, store: registry.provisioning, fetch: this.render.fetch }));
    await using owned = new AsyncDisposableStack();
    owned.defer(() => storage.close());
    const connection = await openWorkOSConnection(config, logger, environment);
    const application = await composeWorkOSApplication(config, connection, {
      logger, signup: { enabled: true, documents: signupDocuments }, loggingStorage: storage, gateway: gateway.partsOn({ storage, resume }),
    });
    owned.move();
    return application;
  }
}
