import { InstanceBase, InstanceStatus } from '@companion-module/base'

import config from './config.js'

import actions from './actions.js'
import feedbacks from './feedbacks.js'
import variables from './variables.js'
import presets from './presets.js'

import constants from './constants.js'

import utils from './utils.js'

import telnet from './telnet.js'
import http from './http.js'
import session from './session.js'

class SnapAVWattboxInstance extends InstanceBase {
	constructor(internal) {
		super(internal)

		Object.assign(this, {
			...config,
			...actions,
			...feedbacks,
			...variables,
			...presets,

			...constants,

			...utils,

			...telnet,
			...http,
			...session,
		})

		this.POLLING_INTERVAL = null //used to poll the device every second
		this.CONNECTED = false //used for friendly notifying of the user that we have not received data yet

		this.DEVICE_DATA = {}

		this.DEVICE_DATA = {
			deviceInfo: {
				hostName: '',
				hardwareVersion: '',
				serialNumber: '',
				cloudStatus: 0,
			},
			powerInfo: {
				voltage: 0,
				current: 0,
				power: 0,
			},
			outletInfo: [],
		}

		this.QUEUE = []

		this.USING_DIGEST_AUTH = false

		// Polling resilience. A busy WattBox drops the occasional response, so tolerate a few
		// before reporting a problem, and back off instead of giving up entirely.
		this.POLL_FAILURES = 0
		this.POLL_FAILURE_TOLERANCE = 3
		this.POLL_BACKOFF = null
		this.POLL_BACKOFF_MAX = 60000

		// Session cookie for property.cgi, established lazily on the first config change.
		this.SESSION_COOKIE = null
	}

	async init(config) {
		this.configUpdated(config)
	}

	async configUpdated(config) {
		this.config = config

		let model = this.MODELS.find((model) => model.id === this.config.model)

		if (model) {
			if (model.protocol) {
				console.log('setting protocol to ' + model.protocol)
				this.config.protocol = model.protocol
			}
		}

		this.buildOutletChoices()

		if (this.POLLING_INTERVAL) {
			clearInterval(this.POLLING_INTERVAL)
			this.POLLING_INTERVAL = null
		}

		this.initActions()
		this.initFeedbacks()
		this.initVariables()
		this.initPresets()

		this.checkVariables()
		this.checkAllFeedbacks()

		if (this.config.protocol === 'http') {
			this.authKey = this.getAuthKey(this.config.username, this.config.password)
			if (this.config.verbose) {
				this.log('debug', 'Auth Key: ' + this.authKey)
			}
			this.updateStatus(InstanceStatus.Connecting)

			this.POLL_FAILURES = 0
			this.POLL_BACKOFF = null
			this.CONNECTED = false

			// Fetch once immediately. Without this, variables stay empty until the first poll tick,
			// and stay empty forever when polling is switched off.
			this.getInformation()

			if (this.config.polling) {
				this.setupInterval()
			}
		} else if (this.config.protocol === 'telnet') {
			this.initTelnet()
		}
	}

	async destroy() {
		if (this.config.protocol === 'telnet') {
			this.sendTelnetCommand('!Exit')
		} else {
			if (this.socket !== undefined) {
				this.socket.destroy()
				delete this.socket
			}

			if (this.POLLING_INTERVAL) {
				clearInterval(this.POLLING_INTERVAL)
				this.POLLING_INTERVAL = null
			}
		}
	}
}

export default SnapAVWattboxInstance
export const UpgradeScripts = []
