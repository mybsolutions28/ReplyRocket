const fs = require('fs')
const { MongoClient } = require('mongodb')

function loadEnv() {
  if (!fs.existsSync('.env')) return
  for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i > 0) process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
}

loadEnv()

const srv = process.env.MONGO_URL
if (!srv) {
  console.error('MONGO_URL not set in .env')
  process.exit(1)
}

const m = srv.match(/mongodb\+srv:\/\/([^:]+):([^@]+)@([^/?]+)/)
if (!m) {
  console.error('Expected mongodb+srv:// in MONGO_URL')
  process.exit(1)
}

const [, user, pass, clusterHost] = m
const base = clusterHost.replace('.mongodb.net', '')

async function tryUri(label, uri) {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 })
  try {
    await client.connect()
    await client.db('sample_mflix').command({ ping: 1 })
    console.log(label + ': OK')
    return uri
  } catch (e) {
    console.log(label + ': FAIL —', e.message)
    return null
  } finally {
    await client.close().catch(() => {})
  }
}

;(async () => {
  console.log('SRV test...')
  const srvOk = await tryUri('SRV', srv)

  const shards = [0, 1, 2].map(
    (n) => `ac-0jyytx0-shard-00-0${n}.y4hey6u.mongodb.net:27017`,
  )
  const encPass = encodeURIComponent(pass)
  const standard = `mongodb://${user}:${encPass}@${shards.join(',')}/?ssl=true&authSource=admin&retryWrites=true&w=majority`
  console.log('Standard (no SRV) test...')
  const stdOk = await tryUri('Standard', standard)

  if (!srvOk && stdOk) {
    console.log('\nUse this in .env as MONGO_URL (Windows local fix):')
    console.log(standard)
  }
})()
