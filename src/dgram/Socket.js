import { EventEmitter } from 'eventemitter3'
import { RemoteInfo } from '../RemoteInfo'

export class Socket extends EventEmitter {
  /** @type {RTCDataChannel} */
  channel

  /** @type {WebRTCProxy} */
  proxy

  /** @type {string} */
  family

  /**
   * Create a new Socket backed by $proxy.
   * 
   * @param {WebRTCProxy} proxy 
   * @param {string} family
   */
  constructor (proxy, family='udp4') {
    super()
    this.proxy = proxy
    this.family = family
  }

  /**
   * Receive a datagram from the socket.
   * 
   * @param {MessageEvent} ev 
   */
  #recv (ev) {
    const buf = Buffer.from(ev.data)
    const rinfo = new RemoteInfo()
    const size = rinfo.unmarshal(buf)
    this.emit('message', buf.subarray(size), {
      address: rinfo.address,
      port: rinfo.port,
      family: rinfo.kind.replace('ipv', 'udp')
    })
  }

  /**
   * Broadcasts a datagram on the socket.
   * 
   * @param {Buffer} msg 
   * @param {number} port
   * @param {string} address 
   * @param {Function=} fn 
   */
  send (msg, port, address, fn) {
    if (!this.channel) throw new Error('channel not open')
    if (!Buffer.isBuffer(msg)) throw new Error('invalid message, expected Buffer')
    const rinfo = new RemoteInfo(address, port)
    this.channel.send(Buffer.concat([ rinfo.marshal(), msg]))
    if (typeof fn === 'function') fn() // optional callback
  }

  /**
   * Listen for datagram messages on a named port.
   */
  bind () {
    const randomId = Math.floor(Math.random() * Math.pow(2, 32))
    this.channel = this.proxy.channel(`sp-${this.family}-${randomId}`, {
      ordered: false,
      maxRetransmits: 5,
      protocol: this.family
    })

    this.channel.addEventListener('error', (ev) => this.emit('error', ev))
    this.channel.addEventListener('open', () => this.emit('listening'))
    this.channel.addEventListener('close', () => this.emit('close'))
    this.channel.addEventListener('message', (ev) => this.emit('channel:message', ev))
    this.channel.addEventListener('message', (ev) => this.#recv(ev))
  }

  /**
   * No-op method provived for compatibility.
   * 
   * @returns {this}
   */
  unref () {
    return this
  }

  /**
   * No-op method provived for compatibility.
   * 
   * Note: this method is not provided by the underlying EventEmitter lib.
   * 
   * @returns {this}
   */
  setMaxListeners () {
    return this
  }

  /**
   * Returns an object containing the address information for a socket.
   * 
   * Note: this method always returns a dummy address, it may be extended
   * in the future to provide address info returned by the proxy host.
   * 
   * @returns {this}
   */
  address () {
    return new RemoteInfo(this.family === 'udp6' ? ':::' : '0.0.0.0')
  }
}