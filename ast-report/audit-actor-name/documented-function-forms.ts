/** Documented unexported function. */
function plain(): number { return 1; }
/** Documented export. */
export function named(): number { return plain(); }
/** Documented default export. */
export default function primary(): number { return named(); }
/** Documented async export. */
export async function asynchronous(): Promise<number> { return primary(); }
/** Documented generator export. */
export function* generator(): Generator<number> { yield primary(); }
/** Documented async generator export. */
export async function* asyncGenerator(): AsyncGenerator<number> { yield await asynchronous(); }
/** Run all fixture functions. */
export async function exercise(): Promise<void> { named(); primary(); await asynchronous(); [...generator()]; for await (const value of asyncGenerator()) { void value; } }
