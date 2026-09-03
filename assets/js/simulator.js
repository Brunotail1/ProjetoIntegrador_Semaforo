'use strict';

/*
 * Máquina de estados do semáforo - controla transições e tempos
 * Estados: RED, YELLOW, GREEN, BLINK_YELLOW (intermitente), SAFETY_RED
 * Ciclo automático usa fases: 0=GREEN, 1=YELLOW→RED, 2=RED
 */
class Semaforo {
	constructor(id, timings, onStateChange) {
		this.id = id;
		// Tempos padrão em milissegundos
		this.timings = Object.assign(
			{ red: 5000, yellow: 3000, green: 5000, safetyInterval: 1000, min: 1000, max: 60000 },
			timings
		);
		// Callback chamado toda vez que muda de estado
		this.onStateChange = onStateChange;

		this.state = 'RED';
		this._phase = 0; // Fase do ciclo automático
		this.running = false;

		this._timer = null;
		this._blinkTimer = null;
		this._stateStartedAt = Date.now();

		// Hook do cruzamento pra coordenar RN01/RN03 (evita 2 verdes ao mesmo tempo)
		this._awaitCrossing = null;
	}

	// Calcula quanto tempo falta pro próximo estado
	get remainingMs() {
		const durations = [this.timings.green, this.timings.yellow, this.timings.red];
		const d = durations[this._phase] || 0;
		return Math.max(0, d - (Date.now() - this._stateStartedAt));
	}

	// Inicia o ciclo automático
	start() {
		if (this.running) return;
		this.running = true;
		this._scheduleNext();
	}

	// Para o ciclo e limpa timers
	stop() {
		this.running = false;
		clearTimeout(this._timer);
		clearInterval(this._blinkTimer);
		this._timer = null;
		this._blinkTimer = null;
	}

	// Processa comandos manuais: 'vermelho', 'verde', 'amarelo', 'intermitente', 'automatico'
	applyCommand(cmd) {
		if (cmd === 'intermitente') { this.enterSafeState(); return; }
		if (cmd === 'automatico')   { this._resumeAutomatic(); return; }

		const stateMap = { vermelho: 'RED', verde: 'GREEN', amarelo: 'YELLOW' };
		const targetState = stateMap[cmd];
		if (!targetState) return;

		// RN02: verde pra vermelho TEM QUE passar pelo amarelo antes
		if (this.state === 'GREEN' && targetState === 'RED') {
			clearTimeout(this._timer);
			this._phase = 1;
			this._doTransition('YELLOW');
			this._timer = setTimeout(() => {
				this._phase = 2;
				this._doTransition('RED');
				if (this.running) this._scheduleNext();
			}, this.timings.yellow);
			return;
		}

		clearTimeout(this._timer);
		if (targetState === 'GREEN')       this._phase = 0;
		else if (targetState === 'YELLOW') this._phase = 1;
		else if (targetState === 'RED')    this._phase = 2;
		this._doTransition(targetState);
		if (this.running) this._scheduleNext();
	}

	// RN04/RN09: modo de segurança (amarelo piscante)
	enterSafeState() {
		this.stop();
		this.running = true; // mantém ativo pra continuar piscando
		this._doTransition('BLINK_YELLOW');
		this._blinkTimer = setInterval(() => {
			if (this.onStateChange) this.onStateChange(this.id, 'BLINK_YELLOW', 'BLINK_YELLOW');
		}, 500);
	}

	// RN05: atualiza tempos do semáforo (valores vêm em segundos, limita entre min/max)
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
		this._phase = 2;
		this._doTransition('RED');
		this._scheduleNext();
	}

	// Agenda próxima transição do ciclo automático
	_scheduleNext() {
		if (!this.running) return;
		if (this.state === 'BLINK_YELLOW' || this.state === 'SAFETY_RED') return;

		const durations = [this.timings.green, this.timings.yellow, this.timings.red];
		const stateNames = ['GREEN', 'YELLOW', 'RED'];
		const nextPhase = (this._phase + 1) % 3;
		const nextStateName = stateNames[nextPhase];
		const currentDuration = durations[this._phase];

		clearTimeout(this._timer);
		this._timer = setTimeout(() => {
			if (!this.running) return;

			// RN01/RN03: antes de abrir o verde, verifica se cruzamento tá seguro
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

	// Executa mudança de estado e registra timestamp
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
