const DELETE_TRASH = true,
	MERGE_HATS = false

const BAMARAMA_BOX = 80086,
	ROOT_BEER = 80081,
	TRASH = [80078, 80079, 80080, 80082], // Beer, Wine, Lotus, Moongourd
	HATS = [80089, 80090], // Afro, Chef's
	ITEMS = [ROOT_BEER, ...TRASH, ...HATS]

const Command = require('command')

module.exports = function RootBeer(dispatch) {
	const command = Command(dispatch)

	let hooks = [],
		gameId = null,
		enabled = false,
		timer = null,
		lastLocation = null,
		statTotal = 0,
		statRootBeers = 0

	command.add('rootbeer', () => {
		if(enabled = !enabled) {
			load()
			openBox()
			command.message('Auto-Rootbeer started.')
		}
		else stop()
	})

	dispatch.hook('S_LOGIN', 9, event => { ({gameId} = event) })
	dispatch.hook('C_PLAYER_LOCATION', 3, event => { lastLocation = event })

	function openBox() {
		dispatch.toServer('C_USE_ITEM', 3, {
			gameId: gameId,
			id: BAMARAMA_BOX,
			amount: 1,
			loc: lastLocation.loc,
			w: lastLocation.w,
			unk4: true
		})
		timer = setTimeout(openBox, 5000)
	}

	function stop() {
		clearTimeout(timer)
		unload()
		enabled = false
		command.message('Auto-Rootbeer stopped.' + (!statTotal ? '' : ' Unboxed ' + statRootBeers + '/' + statTotal + ' (' + ((Math.floor(statRootBeers / statTotal * 1000) / 10) || '0') + '%).'))
		statTotal = statRootBeers = 0
	}

	function deleteItem(slot, amount) {
		dispatch.toServer('C_DEL_ITEM', 2, {
			gameId,
			slot: slot - 40,
			amount
		})
	}

	function mergeItem(slotFrom, slotTo) {
		dispatch.toServer('C_MERGE_ITEM', 1, {slotFrom, slotTo})
	}

	function load() {
		let inventory = null

		hook('S_INVEN', 12, event => {
			if(event.first) inventory = []
			else if(!inventory) return

			for(let item of event.items) inventory.push(item)

			if(!event.more) {
				let box = false, hats = [], idx = -1

				for(let i in HATS) hats.push([])

				for(let item of inventory) {
					if(item.slot < 40) continue // First 40 slots are reserved for equipment, etc.

					if(item.id == BAMARAMA_BOX) box = true
					else if(MERGE_HATS && (idx = HATS.indexOf(item.id)) != -1) hats[idx].push(item.slot)
					else if(DELETE_TRASH && (TRASH.includes(item.id) || HATS.includes(item.id))) deleteItem(item.slot, item.amount)
				}

				for(let hat of hats)
					while(hat.length >= 2) mergeItem(hat.pop(), hat[0])

				if(!box) stop()

				inventory = null
			}
		})

		hook('S_SYSTEM_MESSAGE_LOOT_ITEM', 1, event => {
			if(ITEMS.includes(event.item)) {
				clearTimeout(timer)

				statTotal++
				if(event.item == ROOT_BEER) statRootBeers++

				openBox()
			}
		})

		hook('C_RETURN_TO_LOBBY', 'raw', () => false) // Prevents you from being automatically logged out while AFK
	}

	function unload() {
		if(hooks.length) {
			for(let h of hooks) dispatch.unhook(h)

			hooks = []
		}
	}

	function hook() {
		hooks.push(dispatch.hook(...arguments))
	}
}