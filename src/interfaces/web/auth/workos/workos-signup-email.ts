import { createHash } from 'node:crypto';
import type { SignupActivation } from '../../../../accounts/organizations/signup-activation.ts';
import { readForm, single } from '../../account/account-form.ts';
import { noticePage } from './workos-session-pages.ts';
import { limitedAnswer, type SignupAdmission } from './workos-signup-admission.ts';
import { signupRequestNotice, type AccountCreationState } from './workos-signup-pages.ts';
import type { RequestOperation } from './workos-signup-tenants.ts';

/** The parts of signup that the email check of step 1 uses. */
export interface SignupEmailCheckOptions {
  /** Tells whether the provider has a user with an email. */
  readonly activation: Pick<SignupActivation, 'findAccount'>;
  /** The admission that the POST of the organization form also uses. */
  readonly admission: SignupAdmission;
  /** One fixed error line for the operator. It holds no request value and no provider detail. */
  readonly reportFailure: (message: string) => void;
  /** Step 1 again, with the answer to a posted email. */
  readonly accountPage: (state: AccountCreationState) => Response;
}

/** An address with one @ and a dot after it, without whitespace or a control character. */
const EMAIL = /^[^\s@\x00-\x1F\x7F]+@[^\s@\x00-\x1F\x7F]+\.[^\s@\x00-\x1F\x7F]+$/;
/** The longest address that step 1 accepts, as the maxlength of its field. */
const EMAIL_LIMIT = 254;
/** The fixed line of an account lookup that could not answer. */
const EMAIL_UNCHECKED = 'Hosted signup could not check the email address.';

/**
 * The email check of step 1 of free access: the form, three attempts of each email in a minute, and the account lookup.
 * The email of an account gets the step 1 message with Sign in. Another email goes to the sign-up screen of the
 * provider as the login hint.
 */
export class SignupEmailCheck {
  /** The lookup, the admission, the operator log, and the step 1 page. */
  private readonly options: SignupEmailCheckOptions;

  constructor(options: SignupEmailCheckOptions) {
    this.options = options;
  }

  /** Answers the POST of the step 1 form inside its admission slot. signUp opens the sign-up screen with a login hint. */
  async answer(request: Request, run: RequestOperation, signUp: (loginHint: string) => Promise<Response>): Promise<Response> {
    const form = await readForm(request);
    request.signal.throwIfAborted();
    if (typeof form === 'string') return signupRequestNotice(noticePage(form));
    const { email, typed } = emailFieldOf(form);
    if (email === undefined) return this.options.accountPage({ status: 400, message: 'invalid-email', email: typed });
    if (!this.options.admission.admit(emailKeyOf(email))) return limitedAnswer();
    const account = await run(() => this.options.activation.findAccount({ email, signal: request.signal }));
    request.signal.throwIfAborted();
    if (account.status === 'found') return this.options.accountPage({ status: 409, message: 'existing-account', email });
    // The lookup grants nothing, so a lookup that cannot answer does not stop the account creation. AuthKit then gives
    // its own answer for an email that has an account.
    if (account.status === 'unavailable') this.options.reportFailure(EMAIL_UNCHECKED);
    return signUp(email);
  }
}

/**
 * The email field of the step 1 form. email: the trimmed lowercase address, only when it is valid. typed: the text that
 * the field keeps after a refusal, so that the person can correct it. A missing or repeated value is empty, and a text
 * longer than the field allows is not kept.
 */
function emailFieldOf(form: URLSearchParams): { readonly email?: string; readonly typed: string } {
  const typed = single(form.getAll('email'))?.trim() ?? '';
  const email = typed.toLowerCase();
  if (email.length <= EMAIL_LIMIT && EMAIL.test(email)) return { email, typed };
  return { typed: typed.length > EMAIL_LIMIT ? '' : typed };
}

/**
 * The admission key of an address. The prefix keeps it apart from the subject keys of the organization form. The hash
 * keeps the address out of the admission table and gives each key the same length.
 */
function emailKeyOf(email: string): string {
  return `email:${createHash('sha256').update(email).digest('hex')}`;
}
