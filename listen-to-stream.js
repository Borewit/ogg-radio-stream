const http = require('http')
const mm = require('music-metadata')
const {createLogger, format, transports} = require('winston')
const {combine} = format

const colorizer = format.colorize()

const logger = createLogger({
  level: 'info',
  transports: [
    new transports.Console({
      colorize: true
    }),
  ],
  format: combine(
    format.timestamp(),
    format.simple(),
    format.printf(msg =>
      colorizer.colorize(msg.level, `${msg.timestamp} - ${msg.level}: ${msg.message}`)
    )
  ),
})

let stream
let mimeType
const oggStreamUrl = 'http://stream.radioreklama.bg:80/nrj_low.ogg'

function httpGet (url) {
  return new Promise(function (resolve, reject) {
    http.get(url, function (res) {
      switch (res.statusCode) {
        case 200:
          resolve(res)
          break
        case 302: // redirect
          resolve(httpGet(res.headers.location))
          break
        default:
          reject(new Error('Unexpected status-code:' + res.statusCode))
      }
    })
  })
}

async function streamForever () {
  // Get http content
  stream = await httpGet(oggStreamUrl, {native: true})
  mimeType = stream.headers['content-type']

  if (stream && mimeType) {
    while (stream.readable) {
      await mm.parseStream(stream, mimeType, {
        native: false, skipPostHeaders: true, observer: metaEvent => {

          logger.info(`type=${metaEvent.tag.type} ${metaEvent.tag.id}=${metaEvent.tag.value}`)
        }
      })
      logger.info('End ogg file, proceed to read from the same stream')
    }
    logger.info('End of never ending Ogg stream?')
  } else
    throw new Error('Missing stream or mimeType') // No need to return explicit promise in async function
}

function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function live () {
  logger.info('Live started.')
  do {
    logger.info('Iteration started.')
    await streamForever()
    logger.info('Stream interrupted.')
    await sleep(4000) // Don't reconnect directly, be gentle
  } while (1)
}

live()