// Git plumbing for a job: a fresh worktree from the base branch, a commit, a
// push and a pull request through the GitHub CLI. The runner's own checkout
// is never touched, so a job cannot disturb whatever the owner is editing.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { config, repoRoot } from './config.mjs';

const git = (args, cwd = repoRoot) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

export function createWorktree(branch) {
  mkdirSync(config.worktreesDir, { recursive: true });
  const dir = join(config.worktreesDir, branch.replace(/[^a-z0-9-]/gi, '-'));
  rmSync(dir, { recursive: true, force: true });
  git(['fetch', '-q', config.gitRemote, config.baseBranch]);
  git(['worktree', 'prune']);
  git(['worktree', 'add', '-q', '-b', branch, dir, `${config.gitRemote}/${config.baseBranch}`]);
  // Scripts in the worktree need the dependencies; share the runner's.
  const mods = join(repoRoot, 'node_modules');
  if (existsSync(mods)) symlinkSync(mods, join(dir, 'node_modules'), 'dir');
  return dir;
}

export function removeWorktree(dir, branch) {
  spawnSync('git', ['worktree', 'remove', '--force', dir], { cwd: repoRoot });
  spawnSync('git', ['branch', '-D', branch], { cwd: repoRoot });
}

/** Stage everything and commit. Returns false when there is nothing to commit. */
export function commitAll(dir, message) {
  git(['add', '-A'], dir);
  if (!git(['status', '--porcelain'], dir)) return false;
  git(
    ['-c', 'user.name=chronicle-runner', '-c', 'user.email=runner@users.noreply.github.com', 'commit', '-q', '-m', message],
    dir,
  );
  return true;
}

export function pushBranch(dir, branch) {
  git(['push', '-q', '-u', config.gitRemote, branch], dir);
}

export function openPullRequest(dir, { title, body, base = config.baseBranch, labels = [] }) {
  const args = ['pr', 'create', '--base', base, '--title', title, '--body', body];
  for (const l of labels) args.push('--label', l);
  const out = execFileSync(config.ghBin, args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  return out.split('\n').find((l) => l.startsWith('https://')) ?? out;
}
