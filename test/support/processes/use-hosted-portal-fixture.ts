import { registerHooks } from 'node:module';
import { hostedPortalFixture } from './module-paths.ts';

// Only tests that import this preload replace the production portal alias.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('#hosted-portal/')) {
      return { url: new URL(specifier.slice('#hosted-portal/'.length), hostedPortalFixture).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
