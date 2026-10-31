import type { FakeAnswer, RecordedRequest, WorkOSFakeApi } from './workos-fake-api.ts';
import { queryOf } from './workos-fake-directory.ts';
import { listAnswer, notFound } from './workos-fake-wire.ts';

// What the organization routes read in the fake.
export interface OrganizationView {
  readonly organizationNames: Readonly<Record<string, string>>;
  readonly removedOrganizationIds: ReadonlySet<string>;
  readonly unlistedOrganizationIds: ReadonlySet<string>;
  readonly organizationPageSize: number;
  readonly organizationListOutage: FakeAnswer | undefined;
  readonly laterOrganizationPageOutage: FakeAnswer | undefined;
  organizationJson(organizationId: string): unknown;
}

const organizationNotFound = notFound('Organization not found');

// The routes of the organization reads: the list in pages, and the read by ID. The fake knows the organizations of
// start() and of organizationNames. A removed organization is gone from both. An unlisted one is gone from the list
// only, while a read by its ID still finds it, as the lists of WorkOS lag behind a delete for some seconds (SO-01e,
// SO-01f).
export function answerOrganizationRoutes(fake: WorkOSFakeApi, view: OrganizationView, organizations: readonly string[]): void {
  const started: readonly string[] = [...organizations];
  fake.answer('GET /organizations', (request) => organizationListAnswer(view, started, request));
  fake.answerEach('GET /organizations/:id', (_request, id) => organizationAnswer(view, started, id));
}

function existingOrganizations(view: OrganizationView, started: readonly string[]): readonly string[] {
  const known = [...new Set([...started, ...Object.keys(view.organizationNames)])];
  return known.filter((organizationId) => !view.removedOrganizationIds.has(organizationId));
}

// The after cursor is the ID of the last organization of the page before; the next page starts after it.
function organizationListAnswer(view: OrganizationView, started: readonly string[], request: RecordedRequest): FakeAnswer {
  const query = queryOf(request);
  const after = query.get('after');
  if (view.organizationListOutage) return view.organizationListOutage;
  if (after !== null && view.laterOrganizationPageOutage) return view.laterOrganizationPageOutage;
  const listed = existingOrganizations(view, started).filter((organizationId) => !view.unlistedOrganizationIds.has(organizationId));
  const start = after === null ? 0 : listed.indexOf(after) + 1;
  const end = start + Math.min(Number(query.get('limit') ?? 10), view.organizationPageSize);
  const next = end < listed.length ? listed[end - 1] ?? null : null;
  return listAnswer(listed.slice(start, end).map((organizationId) => view.organizationJson(organizationId)), next);
}

function organizationAnswer(view: OrganizationView, started: readonly string[], organizationId: string): FakeAnswer {
  return existingOrganizations(view, started).includes(organizationId) ? { status: 200, body: view.organizationJson(organizationId) } : organizationNotFound;
}
