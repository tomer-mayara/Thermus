import { createHash } from 'node:crypto';
import type { SignupDocuments } from '../../../src/auth/hosted-auth/workos/workos-signup.ts';

const terms = 'TEST ONLY. Service terms for the signup acceptance test.';
const notice = 'TEST ONLY. This service receives URLs and account details.';
export const signupDocuments: SignupDocuments = Object.freeze({
  version: 'test-bundle-v1',
  terms: Object.freeze({ version: 'test-terms-v1', text: terms, sha256: createHash('sha256').update(terms).digest('hex') }),
  notice: Object.freeze({ version: 'test-notice-v1', text: notice, sha256: createHash('sha256').update(notice).digest('hex') }),
  agreement: Object.freeze({ version: 'test-agreement-v1', text: 'I accept the test terms and acknowledge the test notice.' }),
});
