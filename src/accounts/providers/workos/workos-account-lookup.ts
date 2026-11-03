import type { ListUsersOptions } from '@workos-inc/node';
import type { AccountLookup, SignupActivation } from '../../organizations/signup-activation.ts';

/** The user list of WorkOS, as the account lookup needs it: the email of each user on one page. */
export interface UsersByEmail {
  listUsers(options: ListUsersOptions): Promise<{ readonly data: readonly { readonly email: string }[] }>;
}

const FOUND: AccountLookup = Object.freeze({ status: 'found' });
const ABSENT: AccountLookup = Object.freeze({ status: 'absent' });
const UNAVAILABLE: AccountLookup = Object.freeze({ status: 'unavailable' });

/**
 * Tells step 1 of signup whether WorkOS has a user with this email, from one read of at most one user. WorkOS compares
 * addresses without letter case, so a user of another address makes the answer not valid. A failed read, an answer
 * that is not valid, and a cancelled request give unavailable. The answer grants nothing.
 */
export async function lookUpAccount(users: UsersByEmail, request: Parameters<SignupActivation['findAccount']>[0]): Promise<AccountLookup> {
  const { email, signal } = request;
  try {
    signal.throwIfAborted();
    const page = await users.listUsers({ email, limit: 1 });
    signal.throwIfAborted();
    if (page.data.some((user) => user.email.toLowerCase() !== email.toLowerCase())) return UNAVAILABLE;
    return page.data.length === 0 ? ABSENT : FOUND;
  } catch {
    return UNAVAILABLE;
  }
}
