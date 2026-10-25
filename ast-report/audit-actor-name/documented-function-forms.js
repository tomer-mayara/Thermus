/** Documented unexported function. */
function plain() { return 1; }
/** Documented export. */
export function named() { return plain(); }
/** Documented default export. */
export default function primary() { return named(); }
/** Documented async export. */
export async function asynchronous() { return primary(); }
/** Documented generator export. */
export function* generator() { yield primary(); }
/** Documented async generator export. */
export async function* asyncGenerator() { yield await asynchronous(); }
/** Run all fixture functions. */
export async function exercise() { named(); primary(); await asynchronous(); [...generator()]; for await (const value of asyncGenerator()) {
    void value;
} }
//# sourceMappingURL=documented-function-forms.js.map