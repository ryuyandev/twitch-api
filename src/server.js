require('dotenv').config()

const express = require('express'),
  cors = require('cors'),
  redis = require('redis'),
  axios = require('axios'),
  { promisify } = require('util'),
  { errorHandler, asyncRoute } = require('./helpers')

const app = express()
app.use(cors())
app.use(errorHandler)

app.get('/status/:user', asyncRoute(async (req, res) => {
  const user = 'hatkid' // hardcoded for now to prevent abuse
  const currentTime = new Date()

  const redisSettings = {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT || 6379
  }

  if (process.env.REDIS_PASS)
    redisSettings.password = process.env.REDIS_PASS

  const client = redis.createClient(redisSettings)
  const getAsync = promisify(client.get).bind(client)

  async function expired(cacheTimeKey, cacheInterval) {
    const cacheTime = await getAsync(cacheTimeKey)
    const elapsedSeconds = cacheTime && (currentTime - new Date(cacheTime)) / 1000
    return elapsedSeconds > cacheInterval
  }

  let status = null
  if (!await expired('cacheTime', process.env.CACHE_INTERVAL || 60))
    status = JSON.parse(await getAsync(`${user}_status`))
  else {
    try {
      let token = JSON.parse(await getAsync('token'))
      if (!token || await expired('tokenTime', token.expires_in - 600)) {
        token = (await axios.post('https://id.twitch.tv/oauth2/token', null, {
          params: {
            'client_id': process.env.TWITCH_CLIENT_ID,
            'client_secret': process.env.TWITCH_CLIENT_SECRET,
            'grant_type': 'client_credentials'
          }
        })).data

        client.mset('tokenTime', currentTime, 'token', JSON.stringify(token))
      }

      const statusData = (await axios.get('https://api.twitch.tv/helix/streams', {
        params: {
          'user_login': user,
        },
        headers: {
          'client-id': process.env.TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${token.access_token}`
        }
      })).data.data

      if (statusData.length)
        status = { status: statusData[0].type, title: statusData[0].title }
    } catch (e) {
      client.del('token')
    }

    client.mset('cacheTime', currentTime, `${user}_status`, JSON.stringify(status))
  }

  if (!status)
    status = { status: 'offline' }

  res.json(status)
}))

app.listen(process.env.API_PORT, () => {
  console.log(`Server listening on port ${process.env.API_PORT}`)
})
