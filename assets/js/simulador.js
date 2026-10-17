'use strict';

/*
 * Máquina de estados do semáforo — controla as transições e os tempos de cada cor.
 *
 * Os nomes de estado (RED, YELLOW, GREEN, BLINK_YELLOW) são mantidos em inglês
 * de propósito: eles viajam no payload MQTT e nos seletores CSS [data-state],
 * então funcionam como constantes de protocolo, não como texto de tela.
 *
 * Comando de cor é ordem direta: vai para a cor pedida na hora, sem transição
 * intermediária. O ciclo automático avança por fases: 0 = GREEN, 1 = YELLOW,
 * 2 = RED, e só roda depois do comando 'automatico'.
 */

// Ordem das cores no ciclo automático — o índice é a fase
const ESTADOS_DO_CICLO = ['GREEN', 'YELLOW', 'RED'];

// Traduz o comando recebido (MQTT ou botão da tela) para o estado interno
const ESTADO_POR_COMANDO = { vermelho: 'RED', verde: 'GREEN', amarelo: 'YELLOW' };

// Fase do ciclo correspondente a cada estado fixo
const FASE_POR_ESTADO = { GREEN: 0, YELLOW: 1, RED: 2 };

// Tempo de cada cor em milissegundos e limites da RN05
const TEMPOS_PADRAO = { vermelho: 5000, amarelo: 3000, verde: 5000, minimo: 1000, maximo: 60000 };

class Semaforo {
	constructor(id, tempos, aoMudarEstado) {
		this.id = id;
		this.tempos = Object.assign({}, TEMPOS_PADRAO, tempos);

		// Callback disparado toda vez que o semáforo muda de estado
		this.aoMudarEstado = aoMudarEstado;

		this.estado = 'RED';
		this._fase = 0; // Fase atual do ciclo automático
		this.emExecucao = false;

		this._temporizador = null;
		this._temporizadorPiscar = null;
		this._inicioDoEstado = Date.now();
	}

	// Quanto tempo falta, em ms, pra próxima troca de cor
	get tempoRestanteMs() {
		return Math.max(0, this._duracaoDaFase(this._fase) - (Date.now() - this._inicioDoEstado));
	}

	// Para o ciclo e limpa todos os temporizadores
	parar() {
		this.emExecucao = false;
		clearTimeout(this._temporizador);
		clearInterval(this._temporizadorPiscar);
		this._temporizador = null;
		this._temporizadorPiscar = null;
	}

	// Processa comandos manuais: 'vermelho', 'verde', 'amarelo', 'intermitente', 'automatico'
	aplicarComando(comando) {
		if (comando === 'intermitente') { this.entrarEmModoSeguranca(); return; }
		if (comando === 'automatico')   { this.retomarCicloAutomatico(); return; }

		const estadoDestino = ESTADO_POR_COMANDO[comando];
		if (!estadoDestino) return;

		clearTimeout(this._temporizador);
		// Sair do intermitente exige matar o temporizador do piscar: se ele ficar
		// vivo, segue repintando a tela de amarelo por cima da cor pedida
		clearInterval(this._temporizadorPiscar);
		this._temporizadorPiscar = null;

		this._mudarEstadoPara(estadoDestino);
		if (this.emExecucao) this.agendarProximaTransicao();
	}

	// RN04/RN09: modo de segurança — amarelo piscante
	entrarEmModoSeguranca() {
		this.parar();
		this.emExecucao = true; // mantém ativo pra continuar piscando
		this._mudarEstadoPara('BLINK_YELLOW');
		this._temporizadorPiscar = setInterval(() => {
			if (this.aoMudarEstado) this.aoMudarEstado(this.id, 'BLINK_YELLOW', 'BLINK_YELLOW');
		}, 500);
	}

	// Volta do modo manual/segurança pro ciclo automático, começando no vermelho
	retomarCicloAutomatico() {
		this.parar();
		this.emExecucao = true;
		this._mudarEstadoPara('RED');
		this.agendarProximaTransicao();
	}

	// RN05: atualiza os tempos das cores (valores em segundos, limitados entre mínimo e máximo)
	definirTempos(novosTempos) {
		const { minimo, maximo } = this.tempos;
		const limitar = (segundos) => Math.min(maximo, Math.max(minimo, segundos * 1000));
		['vermelho', 'amarelo', 'verde'].forEach((cor) => {
			const segundos = Number(novosTempos[cor]); // aceita 5 ou "5"; ignora vazio/texto
			if (novosTempos[cor] !== undefined && novosTempos[cor] !== '' && Number.isFinite(segundos)) {
				this.tempos[cor] = limitar(segundos);
			}
		});
	}

	// Agenda a próxima troca de cor do ciclo automático
	agendarProximaTransicao() {
		if (!this.emExecucao) return;
		if (this.estado === 'BLINK_YELLOW') return;

		const proximaFase = (this._fase + 1) % ESTADOS_DO_CICLO.length;
		const proximoEstado = ESTADOS_DO_CICLO[proximaFase];

		clearTimeout(this._temporizador);
		this._temporizador = setTimeout(() => {
			if (!this.emExecucao) return;
			this._mudarEstadoPara(proximoEstado);
			this.agendarProximaTransicao();
		}, this._duracaoDaFase(this._fase));
	}

	// Posiciona o semáforo num estado sem iniciar o ciclo — usado na carga da tela
	definirEstadoInicial(estado) {
		this.parar();
		this._mudarEstadoPara(estado);
	}

	// Reinicia a contagem da fase atual — usado quando os tempos mudam no meio do ciclo,
	// pra contagem regressiva refletir o tempo novo em vez de esperar o temporizador antigo
	reiniciarFaseAtual() {
		this._inicioDoEstado = Date.now();
		this.agendarProximaTransicao();
	}

	// Quanto tempo, em ms, a fase informada dura
	_duracaoDaFase(fase) {
		const duracoes = [this.tempos.verde, this.tempos.amarelo, this.tempos.vermelho];
		return duracoes[fase] || 0;
	}

	// Executa a mudança de estado, sincroniza a fase e avisa quem estiver ouvindo
	_mudarEstadoPara(novoEstado) {
		const estadoAnterior = this.estado;
		this.estado = novoEstado;
		if (FASE_POR_ESTADO[novoEstado] !== undefined) this._fase = FASE_POR_ESTADO[novoEstado];
		this._inicioDoEstado = Date.now();
		if (this.aoMudarEstado) this.aoMudarEstado(this.id, novoEstado, estadoAnterior);
	}
}

window.Semaforo = Semaforo;
