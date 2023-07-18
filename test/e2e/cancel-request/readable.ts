import * as stream from 'stream'
import { Deferred, sleep } from './sleep'

export function Readable() {
  const encoder = new TextEncoder()
  const clean = new Deferred()
  const readable = {
    i: 0,
    streamCleanedUp: clean.promise,
    stream: new stream.Readable({
      async read() {
        await sleep(100)
        this.push(encoder.encode(String(readable.i++)))

        if (readable.i >= 25) {
          clean.reject()
          this.push(null)
        }
      },
      destroy() {
        clean.resolve()
      },
    }),
  }
  return readable
}
