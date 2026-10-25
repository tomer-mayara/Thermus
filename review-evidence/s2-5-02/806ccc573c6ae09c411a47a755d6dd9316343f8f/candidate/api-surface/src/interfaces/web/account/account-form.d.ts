import type { InvitationChangeRequest, InvitationSendRequest, MemberRemovalRequest } from '../../../accounts/organizations/organization-administration.ts';
import type { NoticeName } from './account-pages.ts';
export type FormRefusal = Extract<NoticeName, 'formTypeRefused' | 'formTooLarge' | 'forgedRequest' | 'invalidRequest'>;
export interface Selection {
    readonly organizationId: string;
    readonly returnTo: string;
}
export declare class ReturnDestinations {
    readonly fallback: string;
    private readonly origin;
    private readonly basePath;
    constructor(publicBaseUrl: string, fallback: string);
    check(value: string | undefined): string | undefined;
    urlOf(destination: string): string;
}
export declare function single(values: readonly string[]): string | undefined;
export declare function selectionIn(form: URLSearchParams, csrfToken: string, destinations: ReturnDestinations): Selection | FormRefusal;
export declare function invitationIn(form: URLSearchParams, csrfToken: string): InvitationSendRequest | FormRefusal;
export declare function invitationChangeIn(form: URLSearchParams, csrfToken: string): InvitationChangeRequest | FormRefusal;
export declare function memberRemovalIn(form: URLSearchParams, csrfToken: string): MemberRemovalRequest | FormRefusal;
export declare function readForm(request: Request): Promise<URLSearchParams | FormRefusal>;
export declare function formFields<Name extends string>(form: URLSearchParams, csrfToken: string, names: readonly Name[]): Record<Name, string> | FormRefusal;
