'use strict';

/*
 * twin-local.js — Gêmeo digital de demonstração da seção "Simulação Local"
 * (gemeos.html).
 *
 * Os semáforos da intersecção só mudam de estado quando chega um comando pelo
 * MQTT. Este aqui é o contrário: roda inteiro no navegador e responde apenas
 * aos botões da tela — nada é publicado no broker e ele não entra na
 * coordenação do cruzamento (RN01), então nunca bloqueia nem é bloqueado
 * pelos outros dispositivos.
 *
 * A máquina de estados é a mesma do simulator.js, então a RN02 continua
 * valendo: saindo do verde ele sempre passa pelo amarelo antes do vermelho.
 * Os tempos de cada cor vêm dos inputs em milissegundos da própria seção e
 * passam pelo clamp da RN05 (1000 a 60000 ms).
 */

(() => {
	const DEVICE_ID = 'sim-local';
	const LABEL     = 'Semáforo Simulado';
	const TIMINGS   = { red: 5000, yellow: 3000, green: 5000 };

	// Modo de operação — existe só nesta seção, não é estado do simulador
	const MODE_LABEL = { MANUAL: 'Manual', AUTO: 'Automático', SAFE: 'Segurança' };

	// Qual botão fica destacado em cada estado quando o modo é manual
	const STATE_BTN = { RED: 'vermelho', YELLOW: 'amarelo', GREEN: 'verde' };

	// Nome que o setTimings() do simulador espera para cada cor
	const TIMING_CMD = { red: 'vermelho', yellow: 'amarelo', green: 'verde' };

	document.addEventListener('DOMContentLoaded', () => {
		const stage   = document.getElementById('twin-local-stage');
		const buttons = document.getElementById('twin-local-buttons');
		if (!stage || !buttons) return;

		const elStatus = document.getElementById('twin-local-status');
		const elState  = document.getElementById('twin-local-state');
		const elCdown  = document.getElementById('twin-local-countdown');
		const elMode   = document.getElementById('twin-local-mode');

		// Inputs de tempo (em ms), um por cor
		const tempos = {
			red:    document.getElementById('t-local-vermelho'),
			yellow: document.getElementById('t-local-amarelo'),
			green:  document.getElementById('t-local-verde'),
		};

		let mode = 'MANUAL';

		// Reaproveita o mesmo SVG dos gêmeos da intersecção (app.js)
		stage.innerHTML = buildTwinHTML(DEVICE_ID, LABEL);

		const sem = new Semaforo(DEVICE_ID, TIMINGS, (id, newState) => {
			updateTwin(id, newState); // acende os LEDs do SVG
			render(newState);
		});

		// Atualiza o painel da direita e o destaque dos botões
		function render(state) {
			if (elStatus) elStatus.dataset.state = state;
			if (elState)  elState.textContent = STATE_LABEL[state] || state;
			if (elMode)   elMode.textContent = MODE_LABEL[mode];

			const activeCmd = mode === 'AUTO' ? 'automatico'
				: mode === 'SAFE' ? 'intermitente'
				: STATE_BTN[state];

			buttons.querySelectorAll('.button').forEach((b) => {
				b.classList.toggle('is-active', b.dataset.cmd === activeCmd);
			});
		}

		// Fixa uma cor: stop() antes de tudo pra sair do ciclo automático e
		// zerar o timer do intermitente (applyCommand sozinho só limpa o timer
		// do ciclo, o do piscar continuaria rodando por baixo).
		function fixarCor(cmd) {
			mode = 'MANUAL';
			sem.stop();
			sem.applyCommand(cmd);
		}

		// Mostra nos inputs os tempos que o simulador realmente está usando
		function sincronizarTempos() {
			Object.keys(tempos).forEach((cor) => {
				if (tempos[cor]) tempos[cor].value = sem.timings[cor];
			});
		}

		// Lê os inputs (ms) e repassa pro simulador. setTimings espera segundos
		// e multiplica por 1000, então mando ms/1000 pra aproveitar o clamp da
		// RN05 sem duplicar a regra aqui.
		function aplicarTempos() {
			const cfg = {};
			Object.keys(tempos).forEach((cor) => {
				const el = tempos[cor];
				if (!el) return;
				const ms = parseInt(el.value, 10);
				// Valor inválido (campo vazio, texto): mantém o tempo atual
				cfg[TIMING_CMD[cor]] = (Number.isFinite(ms) ? ms : sem.timings[cor]) / 1000;
			});
			sem.setTimings(cfg);

			// Devolve pros inputs o valor que realmente valeu (já limitado)
			sincronizarTempos();

			// No automático, reinicia a fase atual pra contagem regressiva
			// bater com o tempo novo em vez de esperar o timer antigo.
			if (mode === 'AUTO') {
				sem._stateStartedAt = Date.now();
				sem._scheduleNext();
			}
		}

		Object.keys(tempos).forEach((cor) => {
			const el = tempos[cor];
			if (!el) return;
			el.addEventListener('change', aplicarTempos); // sair do campo / setas
			// Enter aplica na hora, sem precisar sair do campo
			el.addEventListener('keydown', (e) => { if (e.key === 'Enter') aplicarTempos(); });
		});

		buttons.addEventListener('click', (e) => {
			const btn = e.target.closest('.button');
			if (!btn || !btn.dataset.cmd) return;

			const cmd = btn.dataset.cmd;
			if (cmd === 'automatico') {
				mode = 'AUTO';
				sem.applyCommand('automatico');
			} else if (cmd === 'intermitente') {
				mode = 'SAFE';
				sem.applyCommand('intermitente');
			} else {
				fixarCor(cmd);
			}
			render(sem.state);
		});

		// Contagem regressiva — só faz sentido enquanto o ciclo está rodando
		setInterval(() => {
			if (!elCdown) return;
			elCdown.textContent = (mode === 'AUTO' && sem.state !== 'BLINK_YELLOW')
				? Math.ceil(sem.remainingMs / 1000) + 's'
				: '—';
		}, 200);

		// Começa parado no vermelho, esperando o primeiro clique
		sincronizarTempos();
		sem._doTransition('RED');
		render('RED');
	});
})();
