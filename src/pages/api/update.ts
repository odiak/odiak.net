import { NextApiHandler } from 'next'
import { downloadContents } from '../../download-contents'
import { ensureContents } from '../../contents'

const handler: NextApiHandler = async (req, res) => {
  const password = req.query['password'] ?? ''
  if (password === process.env['PASSWORD']) {
    await downloadContents()
    await ensureContents(true)
    res.end('done')
  } else {
    setTimeout(() => {
      res.status(401).end('unauthorized')
    }, 1000)
  }
}
export default handler
