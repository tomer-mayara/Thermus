import { createHash } from 'node:crypto';
import type { SignupDocuments } from '../../../src/accounts/organizations/signup-activation.ts';

const terms = 'TEST ONLY. Service terms for an organization created by its authorized representative.';
const notice = 'TEST ONLY. This service receives URLs and account details.';
export const signupDocuments: SignupDocuments = Object.freeze({
  purpose: 'organization-creation',
  version: 'test-bundle-v2',
  terms: Object.freeze({ version: 'test-terms-v2', text: terms, sha256: createHash('sha256').update(terms).digest('hex') }),
  notice: Object.freeze({ version: 'test-notice-v1', text: notice, sha256: createHash('sha256').update(notice).digest('hex') }),
  agreement: Object.freeze({ version: 'test-agreement-v2', text: 'TEST ONLY. I accept the test terms for this organization, acknowledge the test notice, and confirm that I have authority to act for this organization.' }),
});
