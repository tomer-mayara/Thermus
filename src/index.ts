import { pathToFileURL } from 'node:url';
import { hello } from './hello.js';

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  console.log(hello('world'));
}

export { hello };
