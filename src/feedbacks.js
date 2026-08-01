import { combineRgb } from '@companion-module/base'

export default {
	initFeedbacks: function () {
		const feedbacks = {}

		const foregroundColor = combineRgb(255, 255, 255) // White
		const backgroundColorGreen = combineRgb(0, 255, 0) // Green
		const backgroundColorRed = combineRgb(255, 0, 0) //Red

		feedbacks.outletOn = {
			type: 'boolean',
			name: 'Outlet On',
			description: 'Indicate if an outlet is on',
			defaultStyle: {
				color: foregroundColor,
				bgcolor: backgroundColorGreen,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Outlet',
					id: 'outlet',
					default: 1,
					choices: this.outletChoicesFeedbacks,
				},
			],
			callback: (feedback) => {
				// The option holds a zero based index, which is what outletState expects.
				return this.outletState(parseInt(feedback.options.outlet)) === 1
			},
		}

		feedbacks.outletOff = {
			type: 'boolean',
			name: 'Outlet Off',
			description: 'Indicate if an outlet is off',
			defaultStyle: {
				color: foregroundColor,
				bgcolor: backgroundColorRed,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Outlet',
					id: 'outlet',
					default: '1',
					choices: this.outletChoicesFeedbacks,
				},
			],
			callback: (feedback) => {
				return this.outletState(parseInt(feedback.options.outlet)) === 0
			},
		}

		this.setFeedbackDefinitions(feedbacks)
	},
}
