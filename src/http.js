import xml2js from 'xml2js'
import crypto from 'crypto'
import net from 'net'
import { Buffer } from 'buffer'

import * as cheerio from 'cheerio'

const parseXml = xml2js.parseString

function parseWattboxHtml(html) {
	const deviceInfo = {}
	const outlets = []

	try {
		const $ = cheerio.load(html)

		// Extract system info
		const serviceTag = $('li:contains("SERVICE TAG") span').first().text().trim()
		const model = $('li:contains("MODEL") span').first().text().trim()
		const firmware = $('li:contains("FIRMWARE VERSION") span').first().text().trim()
		const hostname = $('li:contains("SYSTEM NAME") span').first().text().trim()

		deviceInfo.serialNumber = serviceTag
		deviceInfo.model = model
		deviceInfo.hardwareVersion = firmware
		deviceInfo.hostName = hostname

		//outlet info
		$('.grid-block').each((i, el) => {
			const number = $(el).find('.grid-index-label span').first().text().trim()
			const name = $(el).find('.grid-head').first().text().trim()
			const stateImg = $(el).find('.grid-index-label img').attr('src') || ''
			const watts = $(el).find('div[style*="width:50%"]:first-child p').text().trim()
			const amps = $(el).find('div[style*="width:50%"]:last-child p').text().trim()

			const state = stateImg.includes('_on') ? 1 : 0

			if (number) {
				outlets.push({
					id: parseInt(number),
					name,
					state,
					watts,
					amps,
				})
			}
		})
	} catch (error) {
	} finally {
		return {
			deviceInfo,
			outletInfo: outlets,
		}
	}
}

function parseHeaders(rawHeaders) {
	const headers = {}
	const lines = rawHeaders.split('\r\n')
	for (let line of lines) {
		const index = line.indexOf(':')
		if (index > -1) {
			const key = line.slice(0, index).trim()
			const value = line.slice(index + 1).trim()
			headers[key.toLowerCase()] = value
		}
	}
	return headers
}

function generateDigestAuthHeader({
	username,
	password,
	method,
	uri,
	realm,
	nonce,
	opaque,
	qop = 'auth',
	nc = '00000001',
	cnonce,
}) {
	const ha1 = crypto.createHash('md5').update(`${username}:${realm}:${password}`).digest('hex')
	const ha2 = crypto.createHash('md5').update(`${method}:${uri}`).digest('hex')
	const response = crypto.createHash('md5').update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`).digest('hex')

	return `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", qop=${qop}, nc=${nc}, cnonce="${cnonce}", response="${response}", opaque="${opaque}"`
}

export default {
	sendHTTPCommand: function (path) {
		let self = this
		const method = 'GET'

		const tryRequest = (authHeader) => {
			const client = net.createConnection({ host: self.config.ip, port: 80 }, () => {
				client.write(`${method} ${path} HTTP/1.1\r\n`)
				client.write(`Host: ${self.config.ip}\r\n`)
				if (authHeader) client.write(`Authorization: ${authHeader}\r\n`)
				client.write('Connection: close\r\n')
				client.write('\r\n')
			})

			let rawData = ''

			client.on('data', (chunk) => {
				rawData += chunk.toString()
			})

			client.on('end', () => {
				const headersEndIndex = rawData.indexOf('\r\n\r\n')
				if (headersEndIndex !== -1) {
					const headersRaw = rawData.slice(0, headersEndIndex)
					const headers = parseHeaders(headersRaw)

					// A 404 usually means the wrong model is selected, so the configured status path
					// does not exist on this device. Report it and back off, but keep polling: the
					// user may fix the model in config, and a connection that stopped its own timer
					// can only be revived by disabling and re-enabling it.
					if (headersRaw.includes('404 Not Found')) {
						self.pollFailed(`404 Not Found for ${path} — check the Model setting`)
						return
					}

					if (headers['www-authenticate']?.startsWith('Digest') && !self.USING_DIGEST_AUTH) {
						const realmMatch = headers['www-authenticate'].match(/realm="(.+?)"/)
						const nonceMatch = headers['www-authenticate'].match(/nonce="(.+?)"/)
						const opaqueMatch = headers['www-authenticate'].match(/opaque="(.+?)"/)

						if (realmMatch && nonceMatch) {
							const realm = realmMatch[1]
							const nonce = nonceMatch[1]
							const opaque = opaqueMatch ? opaqueMatch[1] : ''
							const cnonce = crypto.randomBytes(8).toString('hex')

							self.digest = { realm, nonce, opaque }
							self.USING_DIGEST_AUTH = true

							const digestHeader = generateDigestAuthHeader({
								username: self.config.username,
								password: self.config.password,
								method,
								uri: path,
								realm,
								nonce,
								opaque,
								cnonce,
							})

							self.sendHTTPCommandWithDigest(path, digestHeader)
							return
						}
					}

					const body = rawData.slice(headersEndIndex + 4)
					const firstIndex = body.indexOf('<')
					const cleanBody = body.slice(firstIndex)

					if (self.config.model === '800vps') {
						const outletData = parseWattboxHtml(cleanBody)
						// This model reports through the web UI rather than the XML API, so it takes
						// a separate path. It still needs the same failure tracking and the same
						// dropdown labelling as everything else.
						if (!outletData || (outletData.outletInfo ?? []).length === 0) {
							self.pollFailed('no outlets found in the web UI response')
							return
						}
						self.DEVICE_DATA = outletData
						self.pollSucceeded()
						self.refreshOutletChoices()
						self.checkAllFeedbacks()
						self.checkVariables()
					} else {
						self.processHttpData(cleanBody)
					}
				}
			})

			client.on('error', (error) => {
				self.pollFailed(`socket error: ${error.message ?? error}`)
			})

			if (self.config.verbose) {
				self.log('debug', `http://${self.config.ip}${path}`)
			}
		}

		// Choose auth method based on global
		if (self.USING_DIGEST_AUTH && self.digest?.realm && self.digest?.nonce) {
			const cnonce = crypto.randomBytes(8).toString('hex')
			const digestHeader = generateDigestAuthHeader({
				username: self.config.username,
				password: self.config.password,
				method,
				uri: path,
				realm: self.digest.realm,
				nonce: self.digest.nonce,
				opaque: self.digest.opaque,
				cnonce,
			})
			tryRequest(digestHeader)
		} else {
			const authHeader = `Basic ${self.authKey}`
			tryRequest(authHeader)
		}
	},

	// Configuration changes go to property.cgi as a form POST, unlike outlet control and status
	// which are GETs against control.cgi and wattbox_info.xml. Sent with the same credentials the
	// rest of the module uses.
	sendHTTPPost: function (path, body, description) {
		let self = this

		const client = net.createConnection({ host: self.config.ip, port: 80 }, () => {
			client.write(`POST ${path} HTTP/1.1\r\n`)
			client.write(`Host: ${self.config.ip}\r\n`)
			client.write(`Authorization: Basic ${self.authKey}\r\n`)
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
			const ok = rawData.includes('200 OK')

			if (ok) {
				if (self.config.verbose) {
					self.log('debug', `${description} accepted`)
				}
				// Read the change back so variables reflect it without waiting for the next poll.
				setTimeout(() => self.getInformation(), 750)
			} else {
				const status = rawData.split('\r\n')[0] ?? 'no response'
				self.log('warn', `${description} may have failed: ${status}`)
			}
		})

		client.on('error', (error) => {
			self.log('error', `${description} failed: ${error.message ?? error}`)
		})

		if (self.config.verbose) {
			self.log('debug', `POST http://${self.config.ip}${path} ${body}`)
		}
	},

	sendHTTPCommandWithDigest: function (path, digestHeader) {
		let self = this

		const client = net.createConnection({ host: self.config.ip, port: 80 }, () => {
			client.write(`GET ${path} HTTP/1.1\r\n`)
			client.write(`Host: ${self.config.ip}\r\n`)
			client.write(`Authorization: ${digestHeader}\r\n`)
			client.write('Connection: close\r\n')
			client.write('\r\n')
		})

		let rawData = ''

		client.on('data', (chunk) => {
			rawData += chunk.toString()
		})

		client.on('end', () => {
			const headersEndIndex = rawData.indexOf('\r\n\r\n')
			const body = rawData.slice(headersEndIndex + 4)
			const firstIndex = body.indexOf('<')
			const cleanBody = body.slice(firstIndex)
			self.processHttpData(cleanBody)
		})

		client.on('error', (error) => {
			self.pollFailed(`digest retry socket error: ${error.message ?? error}`)
		})
	},

	processHttpData: function (data) {
		let self = this

		if (self.config.verbose) {
			self.log('debug', `Raw Data: ${data}`)
		}

		// A WattBox under load answers with an empty body, a partial document, or the web UI's
		// login redirect instead of status XML. Those are normal on a busy device, not faults, so
		// they must not take the connection down.
		if (!data || data.trim() === '') {
			self.pollFailed('empty response')
			return
		}

		try {
			parseXml(data, (err, result) => {
				if (err) {
					self.pollFailed(`unparseable response: ${err.message}`)
					return
				}

				const info = result?.request

				// Anything that is not a <request> document is the device telling us it is busy or
				// wants a login, not status. Retry rather than treating it as a hard failure.
				if (!info) {
					self.pollFailed('response was not WattBox status XML')
					return
				}

				// Every field below is optional on some firmware and truncated responses, so read
				// defensively; one missing element must not discard the rest of the update.
				const first = (field) => (Array.isArray(field) ? field[0] : field)
				const namesArray = String(first(info.outlet_name) ?? '')
					.split(',')
					.filter((n) => n !== '')
				const outletStateArray = String(first(info.outlet_status) ?? '').split(',')

				if (namesArray.length === 0) {
					self.pollFailed('status XML contained no outlet data')
					return
				}

				let parsed = {}

				parsed.deviceInfo = {
					hostName: first(info.host_name) ?? '',
					hardwareVersion: first(info.hardware_version) ?? '',
					serialNumber: first(info.serial_number) ?? '',
					cloudStatus: first(info.cloud_status) ?? '',
				}

				parsed.powerInfo = {
					voltage: first(info.voltage_value) ?? '',
					current: first(info.current_value) ?? '',
					power: first(info.power_value) ?? '',
				}

				parsed.outletInfo = {}

				for (let i = 0; i < namesArray.length; i++) {
					parsed.outletInfo[i] = {
						name: namesArray[i],
						state: outletStateArray[i] ?? '0',
					}
				}

				self.DEVICE_DATA = parsed
				self.pollSucceeded()
				// Outlet names live on the device, so the action and feedback dropdowns can only be
				// labelled once status has been read. Do this before the feedback pass so a rename
				// is reflected everywhere in the same update.
				self.refreshOutletChoices()
				self.checkAllFeedbacks()
				self.checkVariables()
			})
		} catch (error) {
			self.pollFailed(`error parsing XML: ${error.message ?? error}`)
		}
	},
}
