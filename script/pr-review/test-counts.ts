import type { Reason } from './types.ts';

// removedCases names each removed test case as "<file>: <line>". The check cannot see a removed row of a table that
// a loop turns into test cases.
export interface TestCounts {
  readonly added: number;
  readonly removedCases: readonly string[];
  readonly skippedOrTodo: readonly string[];
}

// A removed line belongs to the old path, and an added line to the new path.
interface DiffState {
  oldFile: string;
  newFile: string;
  header: boolean;
  added: number;
  readonly removedCases: string[];
  readonly skippedOrTodo: Set<string>;
}

// A word boundary keeps calls such as submit( and latest( out. A false skip on a text value is acceptable; a
// missed skip is not.
const testCase = /\b(?:\w+\.)?(?:it|test)(?:\.\w+)?\(/u;
const skipMarks = [/\b(?:skip|todo)\b\s*[:,})=]/u, /\.(?:skip|todo)\(/u];

// diff is the output of git diff -U0 --no-prefix for the files under test/. A line of a file header is not
// content, also when it starts with "+++".
export function testCountsOf(diff: string): TestCounts {
  const state: DiffState = { oldFile: '', newFile: '', header: false, added: 0, removedCases: [], skippedOrTodo: new Set() };
  for (const line of diff.split('\n')) readLine(state, line);
  return { added: state.added, removedCases: state.removedCases, skippedOrTodo: [...state.skippedOrTodo] };
}

// Fewer test cases than at the merge base, or a new test that does not run, is ARCHITECT_REVIEW_NEEDED.
export function testReasons(tests: TestCounts): Reason[] {
  const removed = tests.removedCases.length > tests.added ? tests.removedCases : [];
  return [...removed, ...tests.skippedOrTodo.map((file) => `skipped or todo test added in ${file}`)]
    .map((fact) => ({ route: 'ARCHITECT_REVIEW_NEEDED', key: 'size.test_counts', fact }));
}

function readLine(state: DiffState, line: string): void {
  if (line.startsWith('diff --git ')) state.header = true;
  else if (line.startsWith('@@')) state.header = false;
  else if (state.header) readHeaderLine(state, line);
  else if (line.startsWith('+')) readAddedLine(state, line.slice(1));
  else if (line.startsWith('-') && testCase.test(line)) state.removedCases.push(`${state.oldFile}: ${line.slice(1).trim()}`);
}

// Git ends the name of a path with a space with a tab.
function readHeaderLine(state: DiffState, line: string): void {
  const path = line.slice(4).replace(/\t$/u, '');
  if (line.startsWith('--- ')) state.oldFile = path;
  else if (line.startsWith('+++ ')) state.newFile = path;
}

function readAddedLine(state: DiffState, text: string): void {
  if (testCase.test(text)) state.added += 1;
  if (skipMarks.some((mark) => mark.test(text))) state.skippedOrTodo.add(state.newFile);
}
