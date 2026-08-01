export default {
	initActions: function () {
		let self = this

		let actions = {
			power: {
				name: 'Power',
				options: [
					{
						type: 'dropdown',
						label: 'Power on/off',
						id: 'powerState',
						choices: [
							{ id: '0', label: 'Off' },
							{ id: '1', label: 'On' },
						],
						default: '0',
					},
					{
						type: 'dropdown',
						label: 'Outlet',
						id: 'outlet',
						default: '1',
						choices: self.outletChoices,
					},
				],
				callback: (action) => {
					self.controlOutlet(action.options.outlet, action.options.powerState)
				},
			},
			powerToggle: {
				name: 'Power Toggle',
				description:
					'Switches an outlet to the opposite of its last reported state, so one button can do both jobs. Needs polling on to stay in step with changes made elsewhere.',
				options: [
					{
						type: 'dropdown',
						label: 'Outlet',
						id: 'outlet',
						default: '1',
						choices: self.outletChoices,
					},
				],
				callback: (action) => {
					self.toggleOutlet(action.options.outlet)
				},
			},
			powercycle: {
				name: 'Power Cycle',
				options: [
					{
						type: 'dropdown',
						label: 'Outlet',
						id: 'outlet',
						default: '1',
						choices: self.outletChoices,
					},
				],
				callback: (action) => {
					self.controlOutlet(action.options.outlet, 3)
				},
			},
			autoRebootOn: {
				name: 'Auto Reboot On',
				options: [],
				callback: () => {
					self.controlOutlet(0, 4)
				},
			},
			autoRebootOff: {
				name: 'Auto Reboot Off',
				options: [],
				callback: () => {
					self.controlOutlet(0, 5)
				},
			},
			renameOutlet: {
				name: 'Rename Outlet',
				options: [
					{
						type: 'dropdown',
						label: 'Outlet',
						id: 'outlet',
						default: '1',
						choices: self.outletChoices.filter((choice) => choice.id !== '0'),
					},
					{
						type: 'textinput',
						label: 'Name',
						id: 'name',
						default: '',
						useVariables: true,
					},
				],
				callback: (action) => {
					// Companion resolves variables in the option before handing it over, so the value
					// that arrives here is already the finished name.
					self.setOutletName(action.options.outlet, action.options.name)
				},
			},
			setOutletMode: {
				name: 'Set Outlet Mode',
				options: [
					{
						type: 'dropdown',
						label: 'Outlet',
						id: 'outlet',
						default: '1',
						choices: self.outletChoices.filter((choice) => choice.id !== '0'),
					},
					{
						type: 'dropdown',
						label: 'Mode',
						id: 'mode',
						default: '1',
						choices: [
							{ id: '1', label: 'Normal (can be switched on or off)' },
							{ id: '2', label: 'Reset Only (always on, reset permitted)' },
						],
					},
				],
				callback: (action) => {
					self.setOutletMode(action.options.outlet, action.options.mode)
				},
			},
		}

		self.setActionDefinitions(actions)
	},
}
