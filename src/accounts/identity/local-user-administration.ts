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

export interface LocalAuthSettings {
  readonly dataDirectory: string;
  readonly publicBaseUrl: string;
  readonly mcpResourceUrl: string;
}

export interface OpenedLocalAdministration {
  readonly administration: LocalUserAdministration;
  close(): Promise<void>;
}

export interface LocalUserAdministration {
  addUser(email: string, password: PasswordSource): Promise<LocalAccount>;
  listUsers(): Promise<LocalAccount[]>;
  resetPassword(email: string, password: PasswordSource): Promise<LocalAccount>;
  disableUser(email: string): Promise<LocalAccount>;
  registerClient(email: string, password: PasswordSource, client: ApprovedClient): Promise<RegisteredClient>;
}
