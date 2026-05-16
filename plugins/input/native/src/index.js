const bindings = require("bindings")
const EventEmitter = require("events")

const { NativeInputInterface } = bindings({
	bindings: "castmate-plugin-input-native",
})

class InputInterface extends EventEmitter {
	/**
	 * @param {{ backend?: "auto" | "x11" | "uinput" }} [options]
	 *   Only honored by the Linux backend. On Windows/macOS the option is ignored
	 */
	constructor(options) {
		super()
		const boundEmit = this.emit.bind(this)
		this._native = new NativeInputInterface(boundEmit, options || {})
	}

	simulateKeyDown(...args) {
		return this._native.simulateKeyDown(...args)
	}
	simulateKeyUp(...args) {
		return this._native.simulateKeyUp(...args)
	}
	simulateMouseDown(...args) {
		return this._native.simulateMouseDown(...args)
	}
	simulateMouseUp(...args) {
		return this._native.simulateMouseUp(...args)
	}

	startEvents(...args) {
		return this._native.startEvents(...args)
	}
	stopEvents(...args) {
		return this._native.stopEvents(...args)
	}

	isKeyDown(...args) {
		return this._native.isKeyDown(...args)
	}
}

module.exports = { InputInterface }
