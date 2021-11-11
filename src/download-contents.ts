import { google } from 'googleapis'
import fs from 'fs'
import fsp from 'fs/promises'
;(async () => {
  const credentials = JSON.parse(process.env['GOOGLE_CREDENTIALS'] ?? '{}')
  const folderId = process.env['FOLDER_ID']

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly']
  })
  const drive = google.drive({ version: 'v3', auth })

  await fsp.rm('contents', { recursive: true, force: true })
  await fsp.mkdir('contents', { recursive: true })

  let pageToken: string | undefined
  const promises: Array<Promise<never>> = []
  do {
    const data = (await drive.files.list({ q: `'${folderId}' in parents`, pageToken })).data
    if (data.files) {
      for (const file of data.files) {
        console.log(`downloading ${file.name}`)
        drive.files
          .get({ fileId: file.id ?? undefined, alt: 'media' }, { responseType: 'stream' })
          .then(({ data: stream }) => {
            stream.pipe(fs.createWriteStream(`contents/${file.name}`))
            promises.push(
              new Promise((resolve) => {
                stream.on('end', resolve)
              })
            )
          })
      }
    }
    pageToken = data.nextPageToken ?? undefined
  } while (pageToken)
  await Promise.all(promises)
})()
