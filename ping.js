/* global BigInt */

/*  USAGE
 *  node ping [HOSTNAME] [PORT]
 *
 *  Both HOSTNAME and PORT are optional arguments,
 *  a random list of connection test hosts will be
 *  chosen to connect on port 80 (HTTP)
 */

const net = require('net')

const defaultAddresses = [
  'connectivitycheck.gstatic.com',
  'www.msftconnecttest.com',
  'cloudflare.com',
  'google.com',
  'microsoft.com',
  '1.1.1.1'
]
const maxStore = Number.MAX_VALUE
const options = {
  address: process.argv[2] != null
    // true: Uses 2nd argument for `node ping.js ABC.XYZ`
    ? String(process.argv[2]).trim().toLowerCase()
    // false: Selects random address from list of defaults
    : (() => defaultAddresses[Math.random() * defaultAddresses.length])(),
  port: process.argv[3] != null
    ? Number(String(process.argv[3]).trim())
    : 80,
  timeout: 1000
}

function throttle (ms, fn) {
  var lastCallTime
  return function () {
    var now = Date.now()
    if (!lastCallTime || now - lastCallTime > ms) {
      lastCallTime = now
      fn.apply(this, arguments)
    }
  }
}

let pings = BigInt(0)
let pongs = BigInt(0)

const GetPing = () => new Promise(resolve => {
  const socket = new net.Socket()
  const start = process.hrtime.bigint()

  socket.connect(options.port, options.address)

  socket.on('connect', () => {
    const end = process.hrtime.bigint()
    socket.destroy()
    pings++; pongs++
    resolve(end - start)
  })

  socket.on('error', e => {
    socket.destroy()
    pings++
    resolve(null)
  })

  socket.setTimeout(options.timeout, () => {
    socket.destroy()
    pings++
    resolve(null)
  })
})

const jitterValues = []
const pingValues = []

const addToJitterValues = value => {
  if (jitterValues.length > maxStore) jitterValues.shift()
  if (value != null) jitterValues.push(value)
}

const addToPingValues = (value) => {
  if (pingValues.length > maxStore) pingValues.shift()
  if (value != null) pingValues.push(value)
}

const countAverage = values => {
  let sum = 0
  let counted = 0
  for (let i = 0; i < values.length; i++) {
    if (values[i] == null) continue
    sum += Number(nanoToMs(values[i]))
    counted += 1
  }
  const avg = sum / Math.max(counted, 1)
  return avg
}

let prevMessage = process.hrtime.bigint()
let thisMessage = process.hrtime.bigint()

const timeSinceLast = () => {
  const newValue = thisMessage - prevMessage
  prevMessage = thisMessage
  thisMessage = process.hrtime.bigint()
  return newValue
}

const nanoToMs = bigInt => {
  // eslint-disable-next-line
  if (typeof bigInt !== 'bigint') return String(bigInt)
  const ms = bigInt / BigInt(1000000)
  return String(ms)
}

const rd = n => Math.round(Number(nanoToMs(n)))

const PrintResults = throttle(200, function () {
  const averageJitter = rd(countAverage(jitterValues))
  const currentJitter = rd(jitterValues[jitterValues.length - 1])
  const averagePing = rd(countAverage(pingValues))
  const currentPing = rd(pingValues[pingValues.length - 1])

  const packetLoss = Math.abs(((
    Number(
      String(pongs)
    ) / Math.max(1, Number(
      String(pings)
    ))
  ) * 100) - 100).toFixed(2)

  console.log('\x1Bc')
  console.log(`  Ping-Pong!\n`)
  console.log(`  \t\t[Realtime]\t[Average]`)
  console.log(`  Ping:  \t${currentPing}ms\t\t${averagePing}ms`)
  console.log(`  Jitter:\t${currentJitter}ms\t\t${averageJitter}ms`)
  console.log(`\n  Pings: ${pings}\n  Pongs: ${pongs}\n`)
  console.log(`  Packet Loss: ${packetLoss}%\n\n`)
})

const Runner = () => {
  GetPing().then(time => {
    const difference = timeSinceLast()
    addToJitterValues(difference)
    addToPingValues(time)
    PrintResults()
    Runner()
  })
}

Runner()
