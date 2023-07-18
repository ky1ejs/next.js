import { Deferred, sleep } from './sleep'

export function Streamable() {
  const encoder = new TextEncoder()
  const clean = new Deferred()
  const streamable = {
    i: 0,
    streamCleanedUp: clean.promise,
    stream: new ReadableStream({
      async pull(controller) {
        await sleep(100)
        controller.enqueue(encoder.encode(String(streamable.i++)))

        if (streamable.i >= 25) {
          clean.reject()
          controller.close()
        }
      },
      cancel() {
        clean.resolve()
      },
    }),
  }
  return streamable
}
