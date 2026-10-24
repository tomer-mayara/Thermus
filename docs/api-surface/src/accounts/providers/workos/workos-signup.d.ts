import type { CreateOrganizationOptions, CreateOrganizationMembershipOptions, ListOrganizationMembershipsOptions } from '@workos-inc/node';
import type { OrganizationDirectory } from '../../organizations/organization-directory.ts';
import { type SignupActivation, type SignupResult, type SignupState } from '../../organizations/signup-activation.ts';
import { type RoleRecord } from './hosted-role-mapping.ts';
type InspectionRequest = Parameters<SignupActivation['inspect']>[0];
type ActivationRequest = Parameters<SignupActivation['activate']>[0];
interface SignupOrganization {
    readonly id: string;
    readonly name: string;
    readonly externalId: string | null;
    readonly metadata: Readonly<Record<string, string>>;
    readonly domains: readonly unknown[];
}
interface Membership {
    readonly userId: string;
    readonly organizationId: string;
    readonly status: string;
    readonly directoryManaged: boolean;
    readonly roles?: readonly {
        readonly slug: string;
    }[];
}
export interface WorkOSSignupOptions {
    readonly authority: string;
    readonly workos: {
        readonly organizations: {
            getOrganizationByExternalId(externalId: string): Promise<SignupOrganization>;
            getOrganization(id: string): Promise<SignupOrganization>;
            createOrganization(options: CreateOrganizationOptions): Promise<SignupOrganization>;
        };
        readonly userManagement: {
            getUser(userId: string): Promise<{
                readonly id: string;
                readonly emailVerified: boolean;
            }>;
            listOrganizationMemberships(options: ListOrganizationMembershipsOptions): Promise<{
                readonly data: readonly Membership[];
                readonly listMetadata: {
                    readonly after?: string | null;
                };
            }>;
            createOrganizationMembership(options: CreateOrganizationMembershipOptions): Promise<Membership>;
        };
        readonly authorization: {
            listOrganizationRoles(organizationId: string): Promise<{
                readonly data: readonly RoleRecord[];
            }>;
        };
    };
    readonly directory: Pick<OrganizationDirectory, 'membershipsOf'>;
    readonly clock?: () => Date;
}
export declare class WorkOSSignup implements SignupActivation {
    private readonly options;
    constructor(options: WorkOSSignupOptions);
    inspect(request: InspectionRequest): Promise<SignupState>;
    activate(request: ActivationRequest): Promise<SignupResult>;
    private currentUser;
    private chooseWorkspace;
    private hasProductAccess;
    private createOrganization;
    private grantNewWorkspace;
    private recoverAccess;
    private findOrganization;
    private savedAccess;
    private memberships;
}
export {};
