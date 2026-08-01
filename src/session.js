import net from 'net'
import { Buffer } from 'buffer'

// Outlet control (control.cgi) and status (wattbox_info.xml) are happy with HTTP Basic auth, but
// the configuration endpoint (property.cgi) is not: it answers 200 with the web UI's login
// redirect until a session cookie from login.cgi is presented. So configuration changes need a
// short lived browser style session on top of the credentials the module already has.

function parseSetCookie(rawHeaders) {
	// The cookie name is generated per firmware build, so match whatever comes back rather than
	// looking for a known name.
	const match = rawHeaders.match(/set-cookie:\s*([^;\r\n]+)/i)
	return match ? match[1].trim() : null
}

export default {
	// Establishes a session and calls back with the cookie, reusing a live one when possible.
	wattboxLogin: function (callback) {
		let self = this

		const body = `user_login=1&account=${encodeURIComponent(self.config.username)}&password=${encodeURIComponent(
			self.config.password
		)}`

		const client = net.createConnection({ host: self.config.ip, port: 80 }, () => {
			client.write('POST /login.cgi HTTP/1.1\r\n')
			client.write(`Host: ${self.config.ip}\r\n`)
			client.write('Content-Type: application/x-www-form-urlencoded\r\n')
			client.write(`Content-Length: ${Buffer.byteLength(body)}\r\n`)
			client.write('Connection: close\r\n')
			client.write('\r\n')
			client.write(body)
		})

		let rawData = ''

		client.on('data', (chunk) => {
			rawData += chunk.toString()
		})

		client.on('end', () => {
			const headersEndIndex = rawData.indexOf('\r\n\r\n')
			const headersRaw = headersEndIndex === -1 ? rawData : rawData.slice(0, headersEndIndex)
			const cookie = parseSetCookie(headersRaw)

			if (cookie) {
				self.SESSION_COOKIE = cookie
				if (self.config.verbose) {
					self.log('debug', 'WattBox session established')
				}
				callback(cookie)
			} else {
				self.log('error', 'Could not log in to the WattBox. Check the username and password.')
				callback(null)
			}
		})

		client.on('error', (error) => {
			self.log('error', `WattBox login failed: ${error.message ?? error}`)
			callback(null)
		})
	},

	// POSTs a form to a session protected endpoint, logging in first when needed and retrying once
	// if the device decides the session has expired.
	sendSessionPost: function (path, body, description, isRetry) {
		let self = this

		if (!self.SESSION_COOKIE) {
			self.wattboxLogin((cookie) => {
				if (cookie) {
					self.sendSessionPost(path, body, description, isRetry)
				} else {
					self.log('warn', `${description} skipped: no session`)
				}
			})
			return
		}

		const client = net.createConnection({ host: self.config.ip, port: 80 }, () => {
			client.write(`POST ${path} HTTP/1.1\r\n`)
			client.write(`Host: ${self.config.ip}\r\n`)
			client.write(`Cookie: ${self.SESSION_COOKIE}\r\n`)
			client.write('Content-Type: application/x-www-form-urlencoded\r\n')
			client.write(`Content-Length: ${Buffer.byteLength(body)}\r\n`)
			client.write('Connection: close\r\n')
			client.write('\r\n')
			client.write(body)
		})

		let rawData = ''

		client.on('data', (chunk) => {
			rawData += chunk.toString()
		})

		client.on('end', () => {
			// The device does not use 401 for an expired session; it answers 200 with a redirect to
			// login.htm, so that string is the only reliable signal.
			const rejected = rawData.includes('login.htm')

			if (rejected && !isRetry) {
				if (self.config.verbose) {
					self.log('debug', 'WattBox session expired, logging in again')
				}
				self.SESSION_COOKIE = null
				self.sendSessionPost(path, body, description, true)
				return
			}

			if (rejected) {
				self.log('error', `${description} was rejected: the WattBox did not accept the session.`)
				return
			}

			if (self.config.verbose) {
				self.log('debug', `${description} accepted`)
			}

			// Read the change back so variables reflect it without waiting for the next poll.
			setTimeout(() => self.getInformation(), 750)
		})

		client.on('error', (error) => {
			self.log('error', `${description} failed: ${error.message ?? error}`)
		})

		if (self.config.verbose) {
			self.log('debug', `POST http://${self.config.ip}${path} ${body}`)
		}
	},
}
