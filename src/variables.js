export default {
	initVariables: function () {
		// Module API 2.x takes the definitions keyed by variable id rather than as an array.
		const variables = {
			connection: { name: 'Connection' },
			hostName: { name: 'Host Name' },
			hardwareVersion: { name: 'Hardware Version' },
			serialNumber: { name: 'Serial Number' },
			cloudStatus: { name: 'Cloud Status' },
			voltage: { name: 'Voltage' },
			amperage: { name: 'Amperage' },
			wattage: { name: 'Wattage' },
		}

		// Ask the shared helper rather than the model table, so a device set to 'Other' declares the
		// outlet count the user configured instead of falling back to two.
		const outlets = this.outletCount()

		for (let i = 0; i < outlets; i++) {
			variables[`outlet${i + 1}Name`] = { name: `Outlet ${i + 1} Name` }
			variables[`outlet${i + 1}State`] = { name: `Outlet ${i + 1} State` }
		}

		if (this.config.protocol === 'telnet') {
			variables.lastTelnetResponse = { name: 'Last Telnet Response' }
		}

		this.setVariableDefinitions(variables)
	},

	checkVariables: function () {
		try {
			let variableObj = {
				hostName: this.DEVICE_DATA.deviceInfo.hostName,
				hardwareVersion: this.DEVICE_DATA.deviceInfo.hardwareVersion,
				serialNumber: this.DEVICE_DATA.deviceInfo.serialNumber,
				cloudStatus: this.DEVICE_DATA.deviceInfo.cloudStatus,
				voltage: this.DEVICE_DATA.powerInfo?.voltage,
				amperage: this.DEVICE_DATA.powerInfo?.current,
				wattage: this.DEVICE_DATA.powerInfo?.power,
			}

			const outlets = this.outletCount()

			// Outlet data is absent until the first successful poll, so read it defensively rather
			// than throwing and losing the rest of the update.
			const info = this.DEVICE_DATA?.outletInfo
			for (let i = 0; i < outlets; i++) {
				const entry = (Array.isArray(info) ? info[i] : info?.[i]) ?? {}
				variableObj[`outlet${i + 1}Name`] = entry.name ?? ''
				variableObj[`outlet${i + 1}State`] = entry.state == '1' ? 'On' : 'Off'
			}

			if (this.config.protocol === 'telnet') {
				variableObj.lastTelnetResponse = this.lastTelnetResponse
			}

			this.setVariableValues(variableObj)
		} catch (error) {
			console.log(error)
		}
	},
}
