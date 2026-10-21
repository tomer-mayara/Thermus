// The check reads the TypeScript files under src/: .ts, .mts, .cts, .tsx, and the declaration files among them. It
// does not read a JavaScript file.
const typescript = /\.(?:[mc]?ts|tsx)$/u;
const javascript = /\.(?:[mc]?js|jsx)$/u;
const declaration = /\.d\.[mc]?ts$/u;

export function isTypeScript(path: string): boolean {
  return typescript.test(path);
}

export function isJavaScript(path: string): boolean {
  return javascript.test(path);
}

export function isDeclarationFile(path: string): boolean {
  return declaration.test(path);
}
