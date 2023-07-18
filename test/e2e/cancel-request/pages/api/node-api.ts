import { IncomingMessage, ServerResponse } from 'http'
import { pipeline } from 'stream'
import { Readable } from '../../readable'
import { Deferred } from '../../sleep'

export const config = {
  runtime: 'nodejs',
}

let readable
let requestAborted = new Deferred()

export default function handler(
  _req: IncomingMessage,
  res: ServerResponse
): void {
  // Pages API requests have already consumed the body.
  // This is so we don't confuse the request close with the connection close.

  // The 2nd request should render the stats. We don't use a query param
  // because edge rendering will create a different bundle for that.
  if (readable) {
    Promise.all([requestAborted, readable.streamCleanedUp]).finally(() => {
      res.end(`${readable.i}`)
    })
    return
  }

  readable = Readable()
  res.on('close', () => {
    requestAborted.resolve()
  })
  pipeline(readable.stream, res, () => {
    res.end()
  })
}
