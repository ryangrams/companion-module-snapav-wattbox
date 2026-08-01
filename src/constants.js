export default {
	MODELS: [
		{ id: '250', label: 'WB-250-IPW-2', protocol: 'telnet', outlets: 2 },
		{ id: '300', label: 'WB-300-IP-3', protocol: 'http', outlets: 3 },
		{
			id: '300vb',
			label: 'WattBox WB-300VB-IP-5 300 Series IP Power Conditioner (VersaBox)',
			protocol: 'http',
			outlets: 5,
		},
		{ id: '700', label: 'WB-700-IPV-12', protocol: 'http', outlets: 12 },
		{ id: '800vps', label: 'WB-800VPS-IPVM-18', protocol: 'http', outlets: 18 },
		{ id: 'other', label: 'Other' },
	],
}
