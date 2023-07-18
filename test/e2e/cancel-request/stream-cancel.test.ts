import { createNextDescribe } from 'e2e-utils'
import { sleep } from './sleep'
import { get } from 'http'

createNextDescribe(
  'streaming responses cancel inner stream after disconnect',
  {
    files: __dirname,
  },
  ({ next }) => {
    function prime(url: string) {
      return new Promise<void>((resolve) => {
        url = new URL(url, next.url).href

        // There's a bug in node-fetch v2 where aborting the fetch will never abort
        // the connection, because the body is a transformed stream that doesn't
        // close the connection stream.
        // https://github.com/node-fetch/node-fetch/pull/670
        const req = get(url, async (res) => {
          while (true) {
            const value = res.read(1)
            if (value) break
            await sleep(5)
          }

          res.destroy()
          resolve()
        })
        req.end()
      })
    }

    it('Midddleware cancels inner ReadableStream', async () => {
      await prime('/middleware')
      const res = await next.fetch('/middleware')
      const i = +(await res.text())
      expect(i).toBeWithin(0, 5)
    })

    it('App Route Handler Edge cancels inner ReadableStream', async () => {
      await prime('/edge-route')
      const res = await next.fetch('/edge-route')
      const i = +(await res.text())
      expect(i).toBeWithin(0, 5)
    })

    it('App Route Handler NodeJS cancels inner ReadableStream', async () => {
      await prime('/node-route')
      const res = await next.fetch('/node-route')
      const i = +(await res.text())
      expect(i).toBeWithin(0, 5)
    })

    it('Pages Api Route Edge cancels inner ReadableStream', async () => {
      await prime('/api/edge-api')
      const res = await next.fetch('/api/edge-api')
      const i = +(await res.text())
      expect(i).toBeWithin(0, 5)
    })

    it('Pages Api Route NodeJS cancels inner ReadableStream', async () => {
      await prime('/api/node-api')
      const res = await next.fetch('/api/node-api')
      const i = +(await res.text())
      expect(i).toBeWithin(0, 5)
    })
  }
)
