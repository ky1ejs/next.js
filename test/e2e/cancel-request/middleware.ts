import { Streamable } from './streamable'
import { Deferred } from './sleep'

export const config = {
  matcher: '/middleware',
}

let streamable
let requestAborted = new Deferred()

export default async function handler(req: Request): Promise<Response> {
  // Consume the entire request body.
  // This is so we don't confuse the request close with the connection close.
  await req.text()

  // The 2nd request should render the stats. We don't use a query param
  // because edge rendering will create a different bundle for that.
  if (streamable) {
    await Promise.all([requestAborted.promise, streamable.streamCleanedUp])
    return new Response(`${streamable.i}`)
  }

  streamable = Streamable()
  req.signal.onabort = () => {
    requestAborted.resolve()
  }
  return new Response(streamable.stream)
}
