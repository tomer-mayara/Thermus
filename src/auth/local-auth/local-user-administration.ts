import type { DeploymentConfig } from '../../config/deployment-config.ts';

export interface LocalAccount {
  readonly id: string;
  readonly email: string;
  readonly disabled: boolean;
}

export interface ApprovedClient {
  readonly name: string;
  readonly redirectUris: readonly string[];
}

export interface RegisteredClient extends ApprovedClient {
  readonly clientId: string;
  readonly resourceServerClientRegistered: boolean;
}

// Each operation chooses when to request its password.
export type PasswordSource = () => Promise<string>;

export type LocalAuthSettings = Pick<
  Extract<DeploymentConfig, { deployment: 'self-hosted' }>,
  'dataDirectory' | 'publicBaseUrl' | 'mcpResourceUrl'
>;

export interface LocalUserAdministration {
  addUser(email: string, password: PasswordSource): Promise<LocalAccount>;
  listUsers(): Promise<LocalAccount[]>;
  resetPassword(email: string, password: PasswordSource): Promise<LocalAccount>;
  disableUser(email: string): Promise<LocalAccount>;
  registerClient(email: string, password: PasswordSource, client: ApprovedClient): Promise<RegisteredClient>;
}
