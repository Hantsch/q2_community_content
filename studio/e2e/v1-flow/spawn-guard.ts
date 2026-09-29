/**
 * Importing this module records every child process whose command is `git` to the file named by
 * `FLOW_GIT_LOG`, then lets the call proceed. It is the in-process layer next to the PATH shim:
 * on Windows a shell-less `spawn('git')` resolves only git.exe and would skip a git.cmd shim.
 * Works in-process and via `node --import`.
 */
import { appendFileSync } from 'node:fs'
import childProcess, { ChildProcess } from 'node:child_process'
import { syncBuiltinESMExports } from 'node:module'
import { basename } from 'node:path'

const isGit = (command: string): boolean =>
  basename(command.trim().replace(/^["']/, '')).replace(/\.(exe|cmd)["']?$/i, '') === 'git'

/** First token of a shell command string, quotes stripped. */
const firstToken = (command: string): string => /^\s*("[^"]*"|'[^']*'|\S+)/.exec(command)?.[1] ?? ''

function record(command: string, args: readonly unknown[]): void {
  const logPath = process.env.FLOW_GIT_LOG
  if (logPath === undefined || logPath === '') return
  appendFileSync(logPath, `${[command, ...args.map(String)].join(' ')}\n`)
}

function inspectSpawn(file: string, args: readonly unknown[]): void {
  if (isGit(file)) return record(file, args.slice(1))
  // A shell spawn (`sh -c "git ..."`, `cmd.exe /d /s /c "git ..."`) carries the command as one arg.
  const at = args.findIndex(
    (arg) => arg === '-c' || (typeof arg === 'string' && /^\/c$/i.test(arg)),
  )
  const command = at >= 0 ? args[at + 1] : undefined
  if (typeof command === 'string' && isGit(firstToken(command))) record(command, [])
}

type SpawnOptions = { file?: string; args?: unknown[] }
const proto = ChildProcess.prototype as unknown as {
  spawn: (this: ChildProcess, options: SpawnOptions) => unknown
}
const originalSpawn = proto.spawn
proto.spawn = function (this: ChildProcess, options: SpawnOptions) {
  if (typeof options.file === 'string') inspectSpawn(options.file, options.args ?? [])
  return originalSpawn.call(this, options)
}

type Fn = (...a: unknown[]) => unknown
const target = childProcess as unknown as Record<string, Fn>

function wrap(name: 'spawnSync' | 'execFileSync', shellForm: boolean): void {
  const original = target[name]
  target[name] = (...a: unknown[]) => {
    const [file, second, third] = a
    const opts = (Array.isArray(second) ? third : second) as { shell?: unknown } | undefined
    const args = Array.isArray(second) ? second : []
    if (typeof file === 'string') {
      if (shellForm || opts?.shell) {
        if (isGit(firstToken(file))) record(file, args)
      } else if (isGit(file)) record(file, args)
    }
    return original(...a)
  }
}
wrap('spawnSync', false)
wrap('execFileSync', false)

const originalExecSync = target.execSync
target.execSync = (...a: unknown[]) => {
  if (typeof a[0] === 'string' && isGit(firstToken(a[0]))) record(a[0], [])
  return originalExecSync(...a)
}

syncBuiltinESMExports()
