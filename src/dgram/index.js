import { Socket } from './Socket'

/**
 * Return a nodejs compatible dgram interface.
 * 
 * @param {WebRTCProxy} proxy 
 * @returns {dgram}
 */
export default (proxy) => {
  return class dgram {
    static createSocket(family='udp4') {
      return new Socket(proxy, family)
    }
  }
}