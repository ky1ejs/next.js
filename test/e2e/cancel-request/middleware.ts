import { Streamable } from './streamable'

export const config = {
  matcher: '/middleware',
}

let streamable
let requestAborted = false

export default async function handler(req: Request): Promise<Response> {
  // Consume the entire request body.
  // This is so we don't confuse the request close with the connection close.
  await req.text()

  // The 2nd request should render the stats. We don't use a query param
  // because edge rendering will create a different bundle for that.
  if (streamable) {
    return new Response(
      JSON.stringify({
        requestAborted,
        i: streamable.i,
        streamCleanedUp: streamable.streamCleanedUp,
      })
    )
  }

  streamable = Streamable()
  req.signal.onabort = () => {
    requestAborted = true
  }
  return new Response(streamable.stream)
}
