'use strict';

/*
 * gemeo-local.js — gêmeo digital de demonstração da seção "Simulação Local"
 * (gemeos.html).
 *
 * Os semáforos da intersecção só mudam de estado quando chega um comando pelo
 * MQTT. Este aqui é o contrário: roda inteiro no navegador e responde apenas
 * aos botões da tela — nada é publicado no broker.
 *
 * A máquina de estados é a mesma do simulador.js: os botões de cor travam o
 * semáforo na cor escolhida e 'Automático' devolve o ciclo contínuo. Os tempos
 * de cada cor vêm dos campos em milissegundos da própria seção e passam pelo
 * limite da RN05 (1000 a 60000 ms).
 */

(() => {
	const ID_DISPOSITIVO = 'sim-local';
	const ROTULO         = 'Semáforo Simulado';
	const TEMPOS_INICIAIS = { vermelho: 5000, amarelo: 3000, verde: 5000 };

	// Modo de operação — existe só nesta seção, não é estado do simulador
	const ROTULO_MODO = { MANUAL: 'Manual', AUTO: 'Automático', SEGURANCA: 'Segurança' };

	// Qual botão fica destacado em cada estado quando o modo é manual
	const COMANDO_POR_ESTADO = { RED: 'vermelho', YELLOW: 'amarelo', GREEN: 'verde' };

	document.addEventListener('DOMContentLoaded', () => {
		const areaDoSvg   = document.getElementById('twin-local-stage');
		const painelBotoes = document.getElementById('twin-local-buttons');
		if (!areaDoSvg || !painelBotoes) return;

		const elBlocoStatus = document.getElementById('twin-local-status');
		const elEstado      = document.getElementById('twin-local-state');
		const elContagem    = document.getElementById('twin-local-countdown');
		const elModo        = document.getElementById('twin-local-mode');

		// Campos de tempo (em ms), um por cor
		const camposDeTempo = {
			vermelho: document.getElementById('t-local-vermelho'),
			amarelo:  document.getElementById('t-local-amarelo'),
			verde:    document.getElementById('t-local-verde'),
		};

		let modo = 'MANUAL';

		// Reaproveita o mesmo SVG dos gêmeos da intersecção (aplicacao.js)
		areaDoSvg.innerHTML = montarHtmlGemeo(ID_DISPOSITIVO, ROTULO);

		const semaforo = new Semaforo(ID_DISPOSITIVO, TEMPOS_INICIAIS, (id, novoEstado) => {
			atualizarGemeoNaTela(id, novoEstado); // acende os LEDs do SVG
			atualizarPainel(novoEstado);
		});

		// Atualiza o painel da direita e o destaque dos botões
		function atualizarPainel(estado) {
			if (elBlocoStatus) elBlocoStatus.dataset.state = estado;
			if (elEstado)      elEstado.textContent = ROTULO_ESTADO[estado] || estado;
			if (elModo)        elModo.textContent = ROTULO_MODO[modo];

			const comandoAtivo = modo === 'AUTO' ? 'automatico'
				: modo === 'SEGURANCA' ? 'intermitente'
				: COMANDO_POR_ESTADO[estado];

			painelBotoes.querySelectorAll('.button').forEach((botao) => {
				botao.classList.toggle('is-active', botao.dataset.cmd === comandoAtivo);
			});
		}

		// Fixa uma cor: o parar() sai do ciclo automático, senão o simulador
		// voltaria a trocar de cor sozinho depois do comando
		function fixarCorManualmente(comando) {
			modo = 'MANUAL';
			semaforo.parar();
			semaforo.aplicarComando(comando);
		}

		// Mostra nos campos os tempos que o simulador realmente está usando
		function mostrarTemposNosCampos() {
			Object.keys(camposDeTempo).forEach((cor) => {
				if (camposDeTempo[cor]) camposDeTempo[cor].value = semaforo.tempos[cor];
			});
		}

		// Lê os campos (ms) e repassa pro simulador. definirTempos espera segundos
		// e multiplica por 1000, então mando ms/1000 pra aproveitar o limite da
		// RN05 sem duplicar a regra aqui.
		function aplicarTemposDosCampos() {
			const novosTempos = {};
			Object.keys(camposDeTempo).forEach((cor) => {
				const campo = camposDeTempo[cor];
				if (!campo) return;
				const milissegundos = parseInt(campo.value, 10);
				// Valor inválido (campo vazio, texto): mantém o tempo atual
				novosTempos[cor] = (Number.isFinite(milissegundos) ? milissegundos : semaforo.tempos[cor]) / 1000;
			});
			semaforo.definirTempos(novosTempos);

			// Devolve pros campos o valor que realmente valeu (já limitado)
			mostrarTemposNosCampos();

			// No automático, reinicia a fase atual pra contagem regressiva bater
			// com o tempo novo em vez de esperar o temporizador antigo
			if (modo === 'AUTO') semaforo.reiniciarFaseAtual();
		}

		Object.keys(camposDeTempo).forEach((cor) => {
			const campo = camposDeTempo[cor];
			if (!campo) return;
			campo.addEventListener('change', aplicarTemposDosCampos); // sair do campo / setas
			// Enter aplica na hora, sem precisar sair do campo
			campo.addEventListener('keydown', (evento) => {
				if (evento.key === 'Enter') aplicarTemposDosCampos();
			});
		});

		painelBotoes.addEventListener('click', (evento) => {
			const botao = evento.target.closest('.button');
			if (!botao || !botao.dataset.cmd) return;

			const comando = botao.dataset.cmd;
			if (comando === 'automatico') {
				modo = 'AUTO';
				semaforo.aplicarComando('automatico');
			} else if (comando === 'intermitente') {
				modo = 'SEGURANCA';
				semaforo.aplicarComando('intermitente');
			} else {
				fixarCorManualmente(comando);
			}
			atualizarPainel(semaforo.estado);
		});

		// Contagem regressiva — só faz sentido enquanto o ciclo está rodando
		setInterval(() => {
			if (!elContagem) return;
			elContagem.textContent = (modo === 'AUTO' && semaforo.estado !== 'BLINK_YELLOW')
				? Math.ceil(semaforo.tempoRestanteMs / 1000) + 's'
				: '—';
		}, 200);

		// Começa parado no vermelho, esperando o primeiro clique
		mostrarTemposNosCampos();
		semaforo.definirEstadoInicial('RED');
		atualizarPainel('RED');
	});
})();
