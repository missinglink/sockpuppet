import * as dgram from 'node:dgram'
import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import * as wrtc from '@roamhq/wrtc'
import { RemoteInfo } from '../RemoteInfo.js'
import * as defaults from './config.js'

const RTCPeerConnection = wrtc.RTCPeerConnection || wrtc.default.RTCPeerConnection

const port = process.env.PORT || 80

const app = express()
app.use(express.static('public'))
app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: true}))

app.get('/', (req, res) => {
  res.json({ webudp: true })
})

app.post('/', async (req, res) => {
  const { offer, candidates } = req.body
  const localCandidates = []

  const peer = new RTCPeerConnection(defaults)

  peer.addEventListener('error', (ev) => console.error('error', ev))

  peer.addEventListener('datachannel', (ev) => {

    const { label, protocol } = ev.channel
    if (label === '__control') return // ignore control channel

    if (protocol !== 'udp4' && protocol !== 'udp6') {
      console.error(`invalid family: ${label}`)
      return
    }

    // bind a new UDP socket
    const socket = dgram.createSocket(protocol)
    socket.bind(0)

    // close channel
    ev.channel.addEventListener('close', () => socket.close())

    // send msg from socket->channel
    socket.on('message', (msg, rinfo) => {
      // console.error('[SOCKMSG]', ev.channel.label, rinfo, msg)

      ev.channel.send(Buffer.concat([
        new RemoteInfo(rinfo.address, rinfo.port).marshal(),
        msg
      ]))
    })

    // send address info
    // ev.channel.addEventListener('open', (event) => {
    //   ev.channel.send(Buffer.concat([
    //     Buffer.from('__address'),
    //     Buffer.from(JSON.stringify(socket.address()))
    //   ]))
    // })

    ev.channel.addEventListener('error', (ev) => console.error('error', ev))

    // send msg from channel->socket
    ev.channel.addEventListener('message', (event) => {
      if (!socket) {
        console.error("SOCKET NOT OPEN!!")
        return
      }

      const buf = Buffer.from(event.data)
      const rinfo = new RemoteInfo()
      const size = rinfo.unmarshal(buf)

      if (!rinfo.port || !rinfo.address) {
        console.error("INVALID RINFO", rinfo)
        return
      }

      socket.send(
        Buffer.from(event.data).subarray(size),
        rinfo.port,
        rinfo.address
      )
    })
  })

  let responded = false
  setTimeout(() => {
    if (responded) return
    responded = true

    res.json({
      answer: peer.localDescription,
      candidates: localCandidates,
    })
  }, 2000)

  peer.addEventListener('icecandidate', (ev) => {
    if (ev.candidate) {
      localCandidates.push(ev.candidate)
      return
    }

    if (responded) return
    responded = true
    res.json({
      answer: peer.localDescription,
      candidates: localCandidates,
    })
  })

  await peer.setRemoteDescription(offer)
  await peer.setLocalDescription(await peer.createAnswer())
  for (let candidate of candidates) {
    if (!candidate.candidate) { continue }
    // console.error(candidate)
    await peer.addIceCandidate(candidate)
  }
})

app.listen(port, () => console.log('Server started on port ' + port))