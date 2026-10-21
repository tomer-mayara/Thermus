import { routes, type Reason, type Route } from './types.ts';

export function routeOf(reasons: readonly Reason[]): Route {
  return routes.find((route) => reasons.some((reason) => reason.route === route)) ?? 'SHIP';
}

export function orderedReasons(reasons: readonly Reason[]): Reason[] {
  return routes.flatMap((route) => reasons.filter((reason) => reason.route === route));
}

// The check does not know the number of the pull request.
export function labelCommand(route: Route, repository: string | undefined): string {
  const label = (name: Route) => `route:${name.toLowerCase()}`;
  return [
    'gh pr edit <n>',
    ...(repository === undefined ? [] : [`--repo ${repository}`]),
    `--add-label ${label(route)}`,
    ...routes.filter((other) => other !== route).map((other) => `--remove-label ${label(other)}`),
  ].join(' ');
}
