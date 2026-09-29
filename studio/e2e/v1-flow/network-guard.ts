/**
 * Importing this module records every non-loopback socket connect to the file named by
 * `FLOW_NETWORK_LOG`, then lets the connect proceed. Works in-process and via `node --import`.
 */
import { appendFileSync } from 'node:fs'
import net from 'node:net'

const LOOPBACK = new Set(['127.0.0.1', '::1', 'localhost'])

interface ConnectTarget {
  host?: string
  port?: number
  path?: string
}

const original = Reflect.get(net.Socket.prototype, 'connect') as (
  this: net.Socket,
  ...a: unknown[]
) => net.Socket

function guardedConnect(this: net.Socket, ...args: unknown[]): net.Socket {
  const logPath = process.env.FLOW_NETWORK_LOG
  const first = Array.isArray(args[0]) ? (args[0] as unknown[])[0] : args[0]
  if (logPath !== undefined && logPath !== '') {
    let target: ConnectTarget | undefined
    if (typeof first === 'object' && first !== null) target = first
    else if (typeof first === 'number' || typeof first === 'string') {
      // connect(port[, host]) form; a bare string is an IPC path.
      target =
        typeof first === 'number'
          ? { port: first, host: args[1] as string | undefined }
          : { path: first }
    }
    if (target !== undefined && target.path === undefined) {
      const host = target.host ?? 'localhost'
      if (!LOOPBACK.has(host)) appendFileSync(logPath, `${host}:${String(target.port)}\n`)
    }
  }
  return original.apply(this, args)
}

net.Socket.prototype.connect = guardedConnect
