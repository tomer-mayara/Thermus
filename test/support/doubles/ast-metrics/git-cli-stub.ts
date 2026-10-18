// A stub of the git executable for the unit tests of the ast-metrics commands. ast-metrics-cli-path.ts puts a shim
// named git first on a PATH that holds nothing else, and the shim runs this file with Node. The first two arguments
// are the answers: the root of the repository and the commit of HEAD. The stub answers the two calls of
// script/repository.ts that a command makes before it reads its input:
//   rev-parse --show-toplevel                  the root
//   rev-parse --verify --quiet HEAD^{commit}   the commit
// Every other call fails with one line on stderr and exit status 1. A test that needs more of git is an acceptance
// test with a real repository (test/acceptance/script/fixtures/git-repository.ts).
const [root, commit, ...args] = process.argv.slice(2);
const call = args.join(' ');
const answers = new Map([
  ['rev-parse --show-toplevel', root],
  ['rev-parse --verify --quiet HEAD^{commit}', commit],
]);
const answer = answers.get(call);
if (answer === undefined) {
  process.stderr.write(`git-cli-stub: the stub has no answer for git ${call}.\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`${answer}\n`);
}
