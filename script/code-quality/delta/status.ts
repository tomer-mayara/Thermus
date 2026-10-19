import { CommandError } from '../shared/repository.ts';
import { supportedPath, validateChanges, type FileChange } from './changes.ts';
import { changeWithin } from './source.ts';

export function changesInDiff(text: string): FileChange[] {
  if (text === '') return [];
  const records = text.split('\0');
  if (records.pop() !== '') throw new CommandError('The Git change list is not NUL terminated.');
  const changes: FileChange[] = [];
  for (let index = 0; index < records.length;) {
    const code = records[index++];
    const match = /^(A|D|M(?:\d{1,3})?|R\d{1,3})$/u.exec(code);
    if (!match || Number(code.slice(1)) > 100) throw new CommandError(`Unsupported Git change status ${code}.`);
    const first = records[index++];
    const path = code.startsWith('R') ? records[index++] : first;
    if (!first || !path) throw new CommandError('The Git change list has an incomplete path record.');
    const status = code[0] as FileChange['status'];
    changes.push(...changeWithin(status === 'R' ? { status, oldPath: first, path } : { status, path }, supportedPath));
  }
  return validateChanges(changes);
}
