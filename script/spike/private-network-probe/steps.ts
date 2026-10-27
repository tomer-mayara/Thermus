import { FREE_PLAN } from '../render-tenant-lifecycle/calls.ts';
import type { ProbeStep } from './context.ts';
import { controlPlaneJob } from './control-plane-job.ts';
import { job } from './job.ts';
import { preflight } from './preflight.ts';
import { publicCheck } from './public-check.ts';
import { privateService, webService } from './services.ts';

export const preflightStep: ProbeStep = {
  name: 'Preflight',
  spec: 'Given the inputs, when the probe reads the workspace, its registry credentials, and its services, then the credential exists and no other thermus-spike-* service of any type exists.',
  run: preflight,
};

export const probeSteps: readonly (ProbeStep & { readonly id: NonNullable<ProbeStep['id']> })[] = [
  {
    id: 'private', name: 'Private service', run: privateService,
    spec: `Given the inputs, when the probe creates the private service on ${FREE_PLAN} as SO-01c does, then its first deploy is live, and serviceDetails.url holds <slug>:<port> and openPorts holds 8080.`,
  },
  {
    id: 'web', name: 'Web service', run: webService,
    spec: `Given the same image, credential, and variables, when the probe creates a web service on ${FREE_PLAN} in the same region, then its first deploy is live and <public URL>/healthz answers 200 with ok from this machine.`,
  },
  {
    id: 'job', name: 'Job', run: job,
    spec: 'Given both services live, when a one-off job on the web service requests /healthz of the private service on port 10000, on port 8080, and at serviceDetails.url, then its log lines show at least one 200 with ok.',
  },
  {
    id: 'control-plane', name: 'Control plane', run: controlPlaneJob,
    spec: 'Given both services live, when a one-off job on the private service requests /healthz of the web service at its slug on port 8080 and on port 10000, then its log lines show at least one 200 with ok (SO-03: the private address of the control plane).',
  },
  {
    id: 'public-check', name: 'Public check', run: publicCheck,
    spec: 'Given the private service, when this machine looks up its slug and requests http://<slug>:10000/healthz, then the name does not resolve, the request gets no answer, and the service answer holds no public URL.',
  },
];
