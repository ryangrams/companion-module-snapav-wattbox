// Layered presets, module API 2.x.
//
// Every button is built from the same five zone stack rather than one block of text, so an outlet
// reads at a glance from across a room: a mono outlet number top left, a state dot top right, the
// outlet's own name in the middle, and the state word filling the bottom half. Nothing overlaps
// anything else.
//
// Two things drive the look. The outlet name comes from this connection's own variables, so a
// button renames itself when the outlet is renamed on the WattBox. The colour comes from the
// outletOn / outletOff feedbacks through styleOverrides, so state is reported by the device rather
// than assumed by the button. State always changes at least two things at once (fill, edge, dot and
// on the toggle the word itself), which is what makes it readable without staring at it.

// Near black keys with one saturated accent. Green is live, red is cut, everything at rest is dim.
const BG_IDLE = 0x14181d
const BG_ON = 0x0f2e1b
const BG_OFF = 0x2e1013
const EDGE_IDLE = 0x2f353d
const ON_ACCENT = 0x2ea043
const OFF_ACCENT = 0xda3633
const TEXT = 0xf0f3f6
const TEXT_DIM = 0x8b949e
const TEXT_FAINT = 0x6a737d

// A text element's fontsize is a percentage of that element's own height, not of the button, so
// sizes are authored as the share of the button the lettering should occupy and converted here.
// The 1.2 line height divisor is applied by the renderer.
function fontsize(shareOfButton, elementHeight) {
	return Math.round((shareOfButton / elementHeight) * 100)
}

// A style override has to carry the {value, isExpression} wrapper. Companion drops any override
// without it, and a feedback whose overrides have all been dropped is thrown away entirely,
// without logging anything, so the button just quietly never changes colour.
function override(elementId, elementProperty, value) {
	return { elementId, elementProperty, override: { value, isExpression: false } }
}

export default {
	initPresets: function () {
		let self = this

		const presets = {}
		const groups = []

		const outlets = self.outletCount()

		for (let i = 0; i < outlets; i++) {
			const outlet = i + 1

			const configuredName = self.outletName(i)
			const groupName = configuredName ? `${outlet}: ${configuredName}` : `Outlet ${outlet}`

			// Written in variables mode with an expression fallback, so a button dropped before the
			// first poll says "Outlet 3" rather than sitting blank.
			const nameText = {
				value: `$(${self.label}:outlet${outlet}Name) != '' ? $(${self.label}:outlet${outlet}Name) : 'Outlet ${outlet}'`,
				isExpression: true,
			}

			// The face every button shares. `word` is the label across the bottom half; the caller
			// decides whether a feedback rewrites it.
			const face = (word, wordColor) => [
				{
					type: 'box',
					id: 'bg',
					name: 'Background',
					x: 0,
					y: 0,
					width: 100,
					height: 100,
					color: BG_IDLE,
				},
				{
					type: 'box',
					id: 'edge',
					name: 'State edge',
					x: 0,
					y: 0,
					width: 7,
					height: 100,
					color: EDGE_IDLE,
				},
				{
					type: 'text',
					id: 'num',
					name: 'Outlet number',
					x: 13,
					y: 8,
					width: 22,
					height: 14,
					text: `${outlet}`,
					font: 'companion-mono',
					fontsize: fontsize(10.5, 14),
					color: TEXT_FAINT,
					halign: 'left',
					valign: 'center',
				},
				{
					type: 'circle',
					id: 'dot',
					name: 'State dot',
					x: 80,
					y: 7,
					width: 13,
					height: 13,
					color: EDGE_IDLE,
					borderWidth: 0,
				},
				{
					type: 'text',
					id: 'name',
					name: 'Outlet name',
					x: 13,
					y: 26,
					width: 74,
					height: 22,
					text: nameText,
					fontsize: fontsize(15, 22),
					color: TEXT,
					halign: 'left',
					valign: 'center',
				},
				{
					type: 'text',
					id: 'state',
					name: 'State',
					x: 13,
					y: 52,
					width: 74,
					height: 34,
					text: word,
					fontsize: fontsize(32, 34),
					color: wordColor,
					halign: 'left',
					valign: 'center',
				},
			]

			// Companion's own border is the press feedback, so the topbar is not needed and would
			// take a sixth of the face away from the design.
			const canvas = { decoration: 'border' }

			// One key that does both jobs. At rest it reads OFF in grey; the feedback turns the whole
			// face over to ON.
			presets[`outlet${outlet}Toggle`] = {
				type: 'layered',
				name: `${groupName} toggle`,
				keywords: ['outlet', 'power', 'toggle', 'on', 'off'],
				canvas,
				elements: face('OFF', TEXT_DIM),
				steps: [
					{
						down: [
							{
								actionId: 'powerToggle',
								options: { outlet: `${outlet}` },
							},
						],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: 'outletOn',
						options: { outlet: i },
						headline: `Outlet ${outlet} is on`,
						styleOverrides: [
							override('bg', 'color', BG_ON),
							override('edge', 'color', ON_ACCENT),
							override('dot', 'color', ON_ACCENT),
							override('state', 'text', 'ON'),
							override('state', 'color', TEXT),
						],
					},
				],
			}

			// The pair. Each key always does the one thing its label says, and lights up while that
			// is the state the outlet is actually in.
			presets[`outlet${outlet}On`] = {
				type: 'layered',
				name: `${groupName} on`,
				keywords: ['outlet', 'power', 'on'],
				canvas,
				elements: face('ON', TEXT_DIM),
				steps: [
					{
						down: [
							{
								actionId: 'power',
								options: { powerState: '1', outlet: `${outlet}` },
							},
						],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: 'outletOn',
						options: { outlet: i },
						headline: `Outlet ${outlet} is on`,
						styleOverrides: [
							override('bg', 'color', BG_ON),
							override('edge', 'color', ON_ACCENT),
							override('dot', 'color', ON_ACCENT),
							override('state', 'color', TEXT),
						],
					},
				],
			}

			presets[`outlet${outlet}Off`] = {
				type: 'layered',
				name: `${groupName} off`,
				keywords: ['outlet', 'power', 'off'],
				canvas,
				elements: face('OFF', TEXT_DIM),
				steps: [
					{
						down: [
							{
								actionId: 'power',
								options: { powerState: '0', outlet: `${outlet}` },
							},
						],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: 'outletOff',
						options: { outlet: i },
						headline: `Outlet ${outlet} is off`,
						styleOverrides: [
							override('bg', 'color', BG_OFF),
							override('edge', 'color', OFF_ACCENT),
							override('dot', 'color', OFF_ACCENT),
							override('state', 'color', TEXT),
						],
					},
				],
			}

			groups.push({
				id: `outlet${outlet}`,
				type: 'simple',
				name: groupName,
				presets: [`outlet${outlet}Toggle`, `outlet${outlet}On`, `outlet${outlet}Off`],
			})
		}

		const sections = [
			{
				id: 'outlets',
				name: 'Outlets',
				description:
					'One toggle, or a separate on and off pair, for each outlet. Buttons take their label from the name set on the WattBox and their colour from the outlet feedbacks, so turn polling on to see them follow the device.',
				definitions: groups,
			},
		]

		self.setPresetDefinitions(sections, presets)
	},
}
