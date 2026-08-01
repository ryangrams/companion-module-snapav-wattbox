import { Regex } from '@companion-module/base'

export default {
	getConfigFields() {
		return [
			{
				type: 'textinput',
				id: 'ip',
				label: 'IP',
				width: 12,
				regex: Regex.IP,
				default: '192.168.1.1',
			},
			{
				type: 'dropdown',
				label: 'Model',
				id: 'model',
				choices: this.MODELS,
				default: '300',
			},
			{
				type: 'static-text',
				id: 'protocol-static',
				label: 'Protocol',
				width: 12,
				value: 'Telnet',
				isVisibleExpression: `$(options:model) == '250'`,
			},
			{
				type: 'dropdown',
				id: 'protocol',
				label: 'Protocol',
				width: 12,
				default: 'http',
				choices: [
					{ id: 'http', label: 'HTTP' },
					{ id: 'telnet', label: 'Telnet' },
				],
				isVisibleExpression: `$(options:model) == 'other'`,
			},
			{
				type: 'number',
				id: 'outlets',
				label: 'Number of outlets',
				default: 2,
				min: 1,
				max: 18,
				width: 12,
				isVisibleExpression: `$(options:model) == 'other'`,
			},
			{
				type: 'textinput',
				id: 'username',
				label: 'Username',
				width: 12,
				default: 'wattbox',
			},
			{
				type: 'textinput',
				id: 'password',
				label: 'Password',
				width: 12,
				default: 'wattbox',
			},
			{
				type: 'checkbox',
				id: 'polling',
				label: 'Enable Polling?',
				width: 6,
				default: false,
			},
			{
				type: 'number',
				id: 'interval',
				label: `Polling interval in milliseconds`,
				width: 12,
				min: 1000,
				max: 600000,
				default: 5000,
				isVisibleExpression: `$(options:polling)`,
				tooltip:
					'A WattBox has a single threaded web server. Polling faster than about a second makes it return empty or partial responses, so leave this at 5000 unless you have a reason not to.',
			},
			{
				type: 'static-text',
				id: 'hr1',
				width: 12,
				label: ' ',
				value: '<hr />',
			},
			{
				type: 'checkbox',
				id: 'verbose',
				label: 'Enable Verbose Logging',
				default: false,
				width: 4,
			},
		]
	},
}
