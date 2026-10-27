import { DeploymentConfigError } from './deployment-config.ts';

type Environment = Readonly<Record<string, string | undefined>>;

const DEFAULT_OPERATION_CAPACITY = 10;
const MAX_OPERATION_CAPACITY = 100;

// The hosted edition reads OPERATION_CAPACITY at startup: the number of fetch or search calls that run at the same
// time in one process. The error names the setting and its rule, but never the value.
export function loadOperationCapacity(environment: Environment): number {
  const capacity = environment.OPERATION_CAPACITY;
  if (capacity === undefined || capacity === '') return DEFAULT_OPERATION_CAPACITY;
  if (!/^\d{1,3}$/.test(capacity) || Number(capacity) < 1 || Number(capacity) > MAX_OPERATION_CAPACITY) {
    throw new DeploymentConfigError(`OPERATION_CAPACITY must be a whole number from 1 to ${MAX_OPERATION_CAPACITY}.`);
  }
  return Number(capacity);
}
