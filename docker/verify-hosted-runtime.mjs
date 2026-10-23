import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { createApplication } = await import(pathToFileURL(resolve('dist/src/app/application.js')));
const { loadDeploymentConfig } = await import(pathToFileURL(resolve('dist/src/runtime/config/deployment-config.js')));
const { readAdRulesFile } = await import(pathToFileURL(resolve('dist/src/runtime/config/ad-rules-file.js')));

// These values pass local settings checks. The build has no network and makes no provider request.
const environment = {
  DEPLOYMENT: process.env.DEPLOYMENT,
  AD_RULES_FILE: process.env.AD_RULES_FILE,
  LIGHTPANDA_BIN: process.env.LIGHTPANDA_BIN,
  PUBLIC_BASE_URL: 'https://thermus.example/',
  WORKOS_API_KEY: 'sk_test_placeholder',
  WORKOS_CLIENT_ID: 'client_placeholder',
  WORKOS_AUTHKIT_ISSUER: 'https://thermus-test.authkit.app',
  WORKOS_REDIRECT_URI: 'https://thermus.example/callback',
  WORKOS_COOKIE_PASSWORD: 'hosted-image-check-cookie-password-0032',
};
assert.ok(readAdRulesFile(environment).trim().length > 0, 'The hosted image needs a nonempty production rules policy.');
for (const name of ['hosted-ad-rules.SOURCE.md', 'hosted-ad-rules.LICENSE.txt']) {
  assert.ok((await readFile(`/etc/thermus/${name}`, 'utf8')).trim().length > 0, `The hosted image needs readable ${name}.`);
}
const logger = { info: () => {}, error: (message) => { throw new Error(message); } };
const application = await createApplication(loadDeploymentConfig(environment, 'http'), logger, environment);
try {
  for (const path of ['/', '/healthz']) {
    const response = await application.handle(new Request(new URL(path, environment.PUBLIC_BASE_URL)));
    assert.equal(response.status, 200, `The assembled hosted application must serve ${path}.`);
    assert.ok((await response.text()).length > 0);
  }
} finally {
  await application.close();
}
