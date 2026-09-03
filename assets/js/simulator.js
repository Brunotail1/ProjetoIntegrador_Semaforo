'use strict';

/*
 * simulator.js — Pure traffic-light state machine.
 * No DOM, no MQTT. Emits every transition through the onStateChange callback:
 *     onStateChange(id, newState, prevState)
 *
 * States: RED, YELLOW, GREEN, BLINK_YELLOW, SAFETY_RED
 * Automatic cycle uses an internal phase counter:
 *     0 = RED, 1 = YELLOW (towards GREEN), 2 = GREEN, 3 = YELLOW (towards RED)
 */
class Semaforo {
	constructor(id, timings, onStateChange) {
		this.id = id;
		this.timings = Object.assign(
			{ red: 5000, yellow: 3000, green: 5000, safetyInterval: 1000, min: 1000, max: 60000 },
			timings
		);
		this.onStateChange = onStateChange;

		this.state = 'RED';
		this._phase = 0; // 0=RED, 1=YELLOW_TO_GREEN, 2=GREEN, 3=YELLOW_TO_RED
		this.running = false;

		this._timer = null;
		this._blinkTimer = null;
		this._stateStartedAt = Date.now();

		// Set by app.js: hook invoked before a GREEN release so the crossing
		// coordinator can enforce RN01/RN03 (mutual exclusion + safety gap).
		this._awaitCrossing = null;
	}

	/* Milliseconds remaining in the current timed state (0 for non-timed). */
	get remainingMs() {
		const durations = [this.timings.red, this.timings.yellow, this.timings.green, this.timings.yellow];
		const d = durations[this._phase] || 0;
		return Math.max(0, d - (Date.now() - this._stateStartedAt));
	}

	start() {
		if (this.running) return;
		this.running = true;
		this._scheduleNext();
	}

	stop() {
		this.running = false;
		clearTimeout(this._timer);
		clearInterval(this._blinkTimer);
		this._timer = null;
		this._blinkTimer = null;
	}

	/*
	 * Apply a manual command.
	 * cmd ∈ { 'vermelho', 'verde', 'amarelo', 'intermitente', 'automatico' }
	 */
	applyCommand(cmd) {
		if (cmd === 'intermitente') { this.enterSafeState(); return; }
		if (cmd === 'automatico')   { this._resumeAutomatic(); return; }

		const stateMap = { vermelho: 'RED', verde: 'GREEN', amarelo: 'YELLOW' };
		const targetState = stateMap[cmd];
		if (!targetState) return;

		// RN02: a GREEN → RED change must pass through YELLOW first.
		if (this.state === 'GREEN' && targetState === 'RED') {
			clearTimeout(this._timer);
			this._phase = 3;
			this._doTransition('YELLOW');
			this._timer = setTimeout(() => {
				this._phase = 0;
				this._doTransition('RED');
				if (this.running) this._scheduleNext();
			}, this.timings.yellow);
			return;
		}

		clearTimeout(this._timer);
		if (targetState === 'RED')        this._phase = 0;
		else if (targetState === 'GREEN') this._phase = 2;
		// YELLOW keeps whatever phase (direction) it was in.
		this._doTransition(targetState);
		if (this.running) this._scheduleNext();
	}

	/* RN04/RN09 fail-safe: blinking yellow. */
	enterSafeState() {
		this.stop();
		this.running = true; // stay alive to keep the blink callback firing
		this._doTransition('BLINK_YELLOW');
		this._blinkTimer = setInterval(() => {
			if (this.onStateChange) this.onStateChange(this.id, 'BLINK_YELLOW', 'BLINK_YELLOW');
		}, 500);
	}

	/*
	 * RN05: reconfigure durations. Values arrive in seconds; each is clamped
	 * to [min, max] (in ms). Out-of-range values are pulled to the nearest bound.
	 */
	setTimings(cfg) {
		const { min, max } = this.timings;
		const clamp = (v) => Math.min(max, Math.max(min, v * 1000));
		if (cfg.verde    !== undefined) this.timings.green  = clamp(cfg.verde);
		if (cfg.vermelho !== undefined) this.timings.red    = clamp(cfg.vermelho);
		if (cfg.amarelo  !== undefined) this.timings.yellow = clamp(cfg.amarelo);
	}

	_resumeAutomatic() {
		this.stop();
		this.running = true;
		this._phase = 0;
		this._doTransition('RED');
		this._scheduleNext();
	}

	_scheduleNext() {
		if (!this.running) return;
		if (this.state === 'BLINK_YELLOW' || this.state === 'SAFETY_RED') return;

		const durations = [this.timings.red, this.timings.yellow, this.timings.green, this.timings.yellow];
		const stateNames = ['RED', 'YELLOW', 'GREEN', 'YELLOW'];
		const nextPhase = (this._phase + 1) % 4;
		const nextStateName = stateNames[nextPhase];
		const currentDuration = durations[this._phase];

		clearTimeout(this._timer);
		this._timer = setTimeout(() => {
			if (!this.running) return;

			// RN01/RN03: coordinate before releasing GREEN.
			if (nextStateName === 'GREEN' && this._awaitCrossing) {
				this._awaitCrossing(() => {
					if (!this.running) return;
					this._phase = nextPhase;
					this._doTransition('GREEN');
					this._scheduleNext();
				});
				return;
			}

			this._phase = nextPhase;
			this._doTransition(nextStateName);
			this._scheduleNext();
		}, currentDuration);
	}

	_doTransition(newState) {
		const prev = this.state;
		this.state = newState;
		this._stateStartedAt = Date.now();
		if (this.onStateChange) this.onStateChange(this.id, newState, prev);
	}
}

// Expose for the browser (script-tag global) and for CommonJS test runners.
if (typeof window !== 'undefined') window.Semaforo = Semaforo;
if (typeof module !== 'undefined' && module.exports) module.exports = { Semaforo };
