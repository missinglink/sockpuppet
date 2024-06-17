import { Buffer } from 'buffer'
import ipaddr from 'ipaddr.js'

/**
 * Byte encoding: [ size, [ port, port ], ...address ]
 */

export class RemoteInfo {
  /** @type {string} */
  address

  /** @type {number} */
  port

  /** @type {'ipv4'|'ipv6'} */
  kind

  /**
   * Create a new RemoteInfo object
   * 
   * @param {string} address 
   * @param {number} port 
   */
  constructor(address='0.0.0.0', port=0) {
    const addr = ipaddr.parse(address)
    this.kind = addr.kind()
    this.address = addr.toString()
    this.port = port
  }

  /**
   * Encode rinfo as byte Buffer
   * 
   * @returns {Buffer}
   */
  marshal() {
    const addr = ipaddr.parse(this.address)
    const bytes = Buffer.from(addr.toByteArray())
    const frame = Buffer.alloc(3)
    frame.writeUInt8(bytes.byteLength & 0b11111111, 0)
    frame.writeUInt16BE(this.port, 1)

    return Buffer.concat([ frame, bytes ])
  }

  /**
   * Decode rinfo from byte Buffer
   * 
   * @param {Buffer} buf 
   * @returns {number} total bytes read
   */
  unmarshal(buf) {
    const frame = buf.subarray(0, 3)
    const bytes = buf.subarray(3, 3 + frame.readUint8(0))
    const addr = ipaddr.fromByteArray([...bytes])

    this.kind = addr.kind()
    this.address = addr.toString()
    this.port = frame.readUInt16BE(1)

    return frame.byteLength + bytes.byteLength
  }
}