import EventEmitter from 'eventemitter3'
import * as defaults from './config'

export class Proxy extends EventEmitter {
  /** @type {RTCPeerConnection} */
  peer

  /** @type {RTCSessionDescriptionInit} */
  offer

  /** @type {RTCIceCandidate[]} */
  candidates = []

  /**
   * 
   * @param {string} url host connection endpoint
   * @param {Array} iceServers 
   */
  constructor (url, config=defaults) {
    super()

    this.peer = new RTCPeerConnection(config)
    this.peer.onconnectionstatechange = (ev) => this.emit('peer:connectionstatechange', ev)
    this.peer.onsignalingstatechange = (ev) => this.emit('peer:signalingstatechange', ev)
    this.peer.oniceconnectionstatechange = (ev) => this.emit('peer:iceconnectionstatechange', ev)
    this.peer.onicegatheringstatechange = (ev) => this.emit('peer:icegatheringstatechange', ev)
    this.peer.onicecandidate = async (ev) => {
      this.emit('peer:icecandidate', ev)

      // gather candidates as they come in.
      // note: the final call will not include a `.candidate` property.
      if (ev.candidate) {
        this.candidates.push(ev.candidate)
        return
      }

      // send our candidate list to host via HTTP
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            offer: this.offer,
            candidates: this.candidates,
          })
        })
  
        const { answer, candidates } = await res.json()
        await this.peer.setRemoteDescription(answer)
        for (let candidate of candidates) {
          await this.peer.addIceCandidate(candidate)
        }
      } catch (e) {
        console.error('Error connecting to host', e)
        this.emit('error', e)
      }
    }

    // create control channel
    this.channel('__control')

    // generate offer
    this.peer.createOffer().then(offer => {
      this.offer = offer
      this.peer.setLocalDescription(this.offer)
    })
  }

  /**
   * Create a new RTC data channel.
   * 
   * @param {string} label 
   * @param {RTCDataChannelInit} init 
   * @returns 
   */
  channel(label, init = {}) {
    const channel = this.peer.createDataChannel(label, init)
    channel.binaryType = 'arraybuffer'
    return channel
  }
}