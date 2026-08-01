import { InstanceStatus } from '@companion-module/base'

import { Telnet } from 'telnet-client'

export default {
	async initTelnet() {
		let self = this

		self.connection = new Telnet()

		const params = {
			host: self.config.ip,
			port: 23,
			loginPrompt: 'Username: ',
			passwordPrompt: 'Password: ',
			username: `${self.config.username}`,
			password: `${self.config.password}`,
			shellPrompt: 'Successfully Logged In!', // or negotiationMandatory: false
			//negotiationMandatory: false,
			timeout: 1500,
		}

		self.connection.on('data', function (data) {
			let response = data.toString()
			if (response.includes('API locked')) {
				self.log('error', 'API is locked due to too many invalid login attempts.')
				self.updateStatus(InstanceStatus.Error, 'API locked.')
				self.stopInterval()
			} else {
				self.processTelnetResponse(response)
			}
		})

		self.connection.on('ready', async function (prompt) {
			if (prompt.includes('Successfully Logged In!')) {
				console.log('log in successful')
				self.connectionReady = true
				self.updateStatus(InstanceStatus.Ok)

				self.addTelnetCommand('?Firmware')
				self.addTelnetCommand('?Model')
				self.addTelnetCommand('?ServiceTag')
				self.addTelnetCommand('?Hostname')

				self.setupInterval()
			} else {
				console.log('log in failed')
				console.log(prompt)
				self.connectionReady = false
				self.updateStatus(InstanceStatus.Error, 'Invalid prompt received')
				self.log('debug', 'Invalid prompt received, retrying in 10 seconds')
				self.destroy()
				setTimeout(self.init.bind(self), 10000, self.config)
			}
		})

		self.connection.on('error', function (error) {
			console.log('socket error:', error)
		})

		try {
			await self.connection.connect(params)
		} catch (error) {
			self.log('error', `Error connecting to Wattbox: ${error.toString()}`)
		}
	},

	addTelnetCommand: function (command) {
		let self = this

		self.QUEUE.push(command)

		if (self.QUEUE.length === 1) {
			self.sendTelnetCommand(command)
		}
	},

	checkTelnetQueue: function () {
		let self = this

		if (self.QUEUE.length > 0) {
			self.sendTelnetCommand(self.QUEUE[0])
		}
	},

	async sendTelnetCommand(command) {
		let self = this

		if (self.connectionReady) {
			self.log('debug', 'Sending: ' + command)
			await self.connection.send(`${command}`)
			//console.log(res);
		} else {
			self.log('warning', 'Connection not ready, unable to send command at this time.')
		}
	},

	processTelnetResponse: function (response) {
		let self = this

		try {
			let params = response.replace('\n', '').split('=')

			switch (params[0]) {
				case '?Firmware':
					self.DEVICE_DATA.deviceInfo.hardwareVersion = params[1]
					break
				case '?Model':
					self.DEVICE_DATA.deviceInfo.model = params[1]
					break
				case '?ServiceTag':
					self.DEVICE_DATA.deviceInfo.serialNumber = params[1]
					break
				case '?Hostname':
					self.DEVICE_DATA.deviceInfo.hostName = params[1]
					break
				case '?OutletStatus':
					let outletArray = params[1].split(',')
					for (let i = 0; i < self.DEVICE_DATA.outletInfo.length; i++) {
						self.DEVICE_DATA.outletInfo[i].state = parseInt(outletArray[i])
					}
					break
				case '~OutletStatus':
					let outlet = params[1].split(',')
					let outletNum = parseInt(outlet[0])
					let outletState = parseInt(outlet[1])
					self.DEVICE_DATA.outletInfo[outletNum].state = outletState
					break
				case '?OutletName':
					let nameArray = params[1].split(',')
					for (let i = 0; i < self.DEVICE_DATA.outletInfo.length; i++) {
						if (nameArray[i] === undefined) continue
						self.DEVICE_DATA.outletInfo[i].name = nameArray[i].replace('{', '').replace('}', '')
					}
					// Label the action and feedback dropdowns with these names, same as the HTTP path.
					self.refreshOutletChoices()
					break
				case '?AutoReboot':
					self.DEVICE_DATA.deviceInfo.autoReboot = params[1]
					break
				default:
					break
			}
		} catch (error) {
			console.log(error)
		}

		self.lastTelnetResponse = response

		self.checkVariables()
		self.checkAllFeedbacks()

		self.QUEUE.shift()
		self.checkTelnetQueue()
	},
}
