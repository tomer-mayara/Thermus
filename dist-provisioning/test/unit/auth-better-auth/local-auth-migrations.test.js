import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { betterAuth } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { localProviderOptions } from '../../../src/auth-better-auth/better-auth-runtime.js';
const installationId = '0f6c1e9a-4b7d-4e2a-9c35-8d1f2a6b7e40';
const shippedMigrations = ['0001-better-auth.sql', '0002-installation.sql'];
function shippedMigration(name) {
    return readFileSync(new URL(import.meta.resolve(`#auth-local-migrations/${name}`)), 'utf8');
}
function emptyDatabase(t) {
    const database = new DatabaseSync(':memory:');
    t.after(() => database.close());
    return database;
}
function migratedDatabase(t) {
    const database = emptyDatabase(t);
    for (const name of shippedMigrations)
        database.exec(shippedMigration(name));
    return database;
}
function providerOptions(database) {
    return localProviderOptions({
        publicBaseUrl: 'http://localhost:8080/',
        mcpResourceUrl: 'http://localhost:8080/mcp',
        secret: 'unit-test-secret-0123456789abcdef0123456789',
        database,
        installationId,
    });
}
test('Given the pinned provider configuration and an empty SQLite database, when Better Auth compiles its migrations, then the shipped 0001 migration has the same SQL', async (t) => {
    const generated = await (await getMigrations(providerOptions(emptyDatabase(t)))).compileMigrations();
    assert.equal(shippedMigration('0001-better-auth.sql').trimEnd(), generated, 'Regenerate migrations/auth-local/0001-better-auth.sql from compileMigrations() for the pinned configuration.');
});
test('Given an empty database with the shipped migrations, when Better Auth plans migrations and checks its schema, then nothing is missing', async (t) => {
    const database = migratedDatabase(t);
    const plan = await getMigrations(providerOptions(database));
    const context = await betterAuth(providerOptions(database)).$context;
    assert.deepEqual([plan.toBeCreated, plan.toBeAdded, plan.toBeAddedIndexes, plan.schemaProblems], [[], [], [], []]);
    assert.ok(context.checkSchema, 'the provider checks the schema of this adapter');
    await context.checkSchema();
});
test('Given the shipped installation migration, when identities and accounts are added, then it keeps one installation identity and does not limit accounts', async (t) => {
    const database = migratedDatabase(t);
    const addIdentity = database.prepare('INSERT INTO "magumagu_installation" ("singleton", "id") VALUES (?, ?)');
    const auth = betterAuth(providerOptions(database));
    addIdentity.run(1, installationId);
    for (const name of ['ann', 'ben', 'cy']) {
        await auth.api.createUser({ body: { email: `${name}@example.com`, password: `${name}-password-1`, name } });
    }
    assert.throws(() => addIdentity.run(1, '4b0f2b8e-6f0d-4c1e-9f3a-2d5c7e8a9b10'), /UNIQUE constraint failed/);
    assert.throws(() => addIdentity.run(2, '4b0f2b8e-6f0d-4c1e-9f3a-2d5c7e8a9b10'), /CHECK constraint failed/);
    assert.deepEqual(database.prepare('SELECT "id" FROM "magumagu_installation"').all().map(({ id }) => id), [installationId]);
    assert.equal(await (await auth.$context).internalAdapter.countTotalUsers(), 3);
});
//# sourceMappingURL=local-auth-migrations.test.js.map