import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

import { installGitShim } from '../e2e/v1-flow/git-shim'
import { snapshotTree } from '../e2e/v1-flow/news-snapshot'
import { createFlowSandbox } from '../e2e/v1-flow/sandbox'

const studioDir = dirname(dirname(fileURLToPath(import.meta.url)))
const repoRoot = dirname(studioDir)
const guardUrl = pathToFileURL(join(studioDir, 'e2e', 'v1-flow', 'network-guard.ts')).href

const spawnGuardUrl = pathToFileURL(join(studioDir, 'e2e', 'v1-flow', 'spawn-guard.ts')).href

const cleanups: (() => void)[] = []
afterEach(() => {
  while (cleanups.length > 0) cleanups.pop()?.()
})
const tmp = (): string => {
  const d = mkdtempSync(join(tmpdir(), 'q2-harness-test-'))
  cleanups.push(() => rmSync(d, { recursive: true, force: true }))
  return d
}

describe('v1 flow harness', () => {
  it('the sandbox holds the fixture news, the real kit and the scratch marker, outside the repository', () => {
    const box = createFlowSandbox(repoRoot)
    cleanups.push(box.cleanup)
    expect(relative(repoRoot, box.root).startsWith('..')).toBe(true)
    const index = JSON.parse(readFileSync(join(box.root, 'news', 'index.json'), 'utf8')) as {
      entries: { id: string }[]
    }
    expect(index.entries.map((e) => e.id)).toEqual(['fixture-welcome'])
    expect(existsSync(join(box.root, 'news', '2026-01-01-fixture-welcome.md'))).toBe(true)
    expect(existsSync(join(box.root, '.q2-studio-e2e-scratch'))).toBe(true)
    expect(snapshotTree(join(box.root, 'news', '_templates'))).toEqual(
      snapshotTree(join(repoRoot, 'news', '_templates')),
    )
    // Negative: the repository's own published entries are not copied in.
    expect(existsSync(join(box.root, 'news', '2026-09-12-welcome-to-the-community.md'))).toBe(false)
    for (const d of ['studio', 'engines', 'gamedata', 'packs', 'mods', 'config_templates']) {
      expect(readdirSync(join(box.root, d))).toEqual([])
    }
    box.cleanup()
    expect(existsSync(box.root)).toBe(false)
  })

  it('snapshotTree detects a one-byte change', () => {
    const dir = tmp()
    writeFileSync(join(dir, 'a.txt'), 'abc')
    writeFileSync(join(dir, 'b.txt'), 'xyz')
    const before = snapshotTree(dir)
    expect(snapshotTree(dir)).toEqual(before)
    expect(Object.keys(before)).toEqual(['a.txt', 'b.txt'])
    writeFileSync(join(dir, 'b.txt'), 'xyy')
    const after = snapshotTree(dir)
    expect(after['a.txt']).toBe(before['a.txt'])
    expect(after['b.txt']).not.toBe(before['b.txt'])
  })

  it('the network guard records a non-loopback connect and ignores 127.0.0.1', async () => {
    const log = join(tmp(), 'net.log')
    writeFileSync(log, '')
    const server = net.createServer((s) => s.destroy())
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    const port = (server.address() as net.AddressInfo).port
    const script = `
      const net = require('node:net');
      const s = net.connect({ host: '127.0.0.1', port: ${port} });
      s.on('error', () => {});
      s.on('close', () => {
        const t = net.connect({ host: '192.0.2.1', port: 9 });
        t.on('error', () => {});
        t.destroy();
      });`
    // Async spawn: the loopback listener lives in this process and must keep serving.
    const run = await new Promise<{ status: number | null; stderr: string }>((resolve) => {
      const child = spawn(
        process.execPath,
        ['--import', 'tsx', '--import', guardUrl, '-e', script],
        {
          env: { ...process.env, FLOW_NETWORK_LOG: log },
          cwd: studioDir,
        },
      )
      let stderr = ''
      child.stderr.on('data', (c: Buffer) => (stderr += c.toString()))
      child.on('close', (status) => resolve({ status, stderr }))
    })
    server.close()
    expect(run.status, run.stderr).toBe(0)
    // The loopback connect is silent; only the documentation-range address is logged.
    expect(readFileSync(log, 'utf8').split('\n').filter(Boolean)).toEqual(['192.0.2.1:9'])
  })

  it('the git shim records an invocation found through PATH', () => {
    const shim = installGitShim()
    cleanups.push(() => rmSync(shim.binDir, { recursive: true, force: true }))
    // Negative: nothing is logged until git is actually invoked.
    expect(existsSync(shim.logPath)).toBe(false)
    const run = spawnSync('git', ['status', '--short'], {
      env: { ...process.env, PATH: `${shim.binDir}${delimiter}${process.env.PATH ?? ''}` },
      encoding: 'utf8',
      shell: process.platform === 'win32',
    })
    expect(run.status).toBe(1)
    expect(readFileSync(shim.logPath, 'utf8')).toContain('status --short')
  })
  describe('the spawn guard', () => {
    const runGuarded = (script: string, log: string) =>
      spawnSync(process.execPath, ['--import', 'tsx', '--import', spawnGuardUrl, '-e', script], {
        env: { ...process.env, FLOW_GIT_LOG: log },
        cwd: studioDir,
        encoding: 'utf8',
      })

    it('records a shell-less spawnSync of git and an execSync git command', () => {
      const log = join(tmp(), 'git.log')
      const run = runGuarded(
        `const cp = require('node:child_process');
         cp.spawnSync('git', ['--version']);
         try { cp.execSync('git status', { stdio: 'ignore' }) } catch {}`,
        log,
      )
      expect(run.status, run.stderr).toBe(0)
      const lines = readFileSync(log, 'utf8').split('\n').filter(Boolean)
      expect(lines.some((line) => line.includes('git --version'))).toBe(true)
      expect(lines.some((line) => line.includes('git status'))).toBe(true)
    })

    it('records an async spawn of git', () => {
      const log = join(tmp(), 'git.log')
      const run = runGuarded(
        `require('node:child_process').spawn('git', ['--version'], { stdio: 'ignore' }).on('error', () => {})`,
        log,
      )
      expect(run.status, run.stderr).toBe(0)
      expect(readFileSync(log, 'utf8')).toContain('git --version')
    })

    it('ignores a non-git spawn', () => {
      const log = join(tmp(), 'git.log')
      const run = runGuarded(
        `const cp = require('node:child_process'); cp.spawnSync('node', ['-v']); cp.execSync('node -v', { stdio: 'ignore' })`,
        log,
      )
      expect(run.status, run.stderr).toBe(0)
      expect(existsSync(log)).toBe(false)
    })
  })
})
