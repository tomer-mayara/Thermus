import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
export function dataDirectory(t) {
    const directory = mkdtempSync(join(tmpdir(), 'magumagu-data-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    return directory;
}
export function changeDatabase(directory, sql) {
    const database = new DatabaseSync(join(directory, 'auth.sqlite'));
    try {
        database.exec(sql);
    }
    finally {
        database.close();
    }
}
export function storedInstallationIds(directory) {
    const database = new DatabaseSync(join(directory, 'auth.sqlite'), { readOnly: true });
    try {
        return database.prepare('SELECT "id" FROM "magumagu_installation"').all().map(({ id }) => String(id));
    }
    finally {
        database.close();
    }
}
//# sourceMappingURL=data-directory.js.map