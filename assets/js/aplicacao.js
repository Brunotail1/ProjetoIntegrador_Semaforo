'use strict';

// ── Montagem do gêmeo digital (SVG) ──────────────────────────────────────────
// Monta o HTML de um semáforo: SVG + rótulo + emblema de estado + contagem.
// O id entra nos ids dos gradientes do SVG, por isso é higienizado antes.
function montarHtmlGemeo(id, rotulo) {
	const idSeguro = id.replace(/[^a-zA-Z0-9_-]/g, '_');
	return `<div id="twin-${id}" class="twin-semaforo" data-state="RED">
<svg class="semaforo-svg" viewBox="0 0 120 370" xmlns="http://www.w3.org/2000/svg" aria-label="${rotulo}">
			<defs>
				<radialGradient id="sheen-${idSeguro}" cx="30%" cy="25%" r="50%">
					<stop offset="0%" stop-color="rgba(255,255,255,0.18)"/>
					<stop offset="100%" stop-color="rgba(255,255,255,0)"/>
				</radialGradient>
				<linearGradient id="hsg-${idSeguro}" x1="0%" y1="0%" x2="100%" y2="0%">
					<stop offset="0%"   stop-color="#242424"/>
					<stop offset="14%"  stop-color="#3a3a3a"/>
					<stop offset="50%"  stop-color="#2e2e2e"/>
					<stop offset="86%"  stop-color="#262626"/>
					<stop offset="100%" stop-color="#181818"/>
				</linearGradient>
				<linearGradient id="pole-${idSeguro}" x1="0%" y1="0%" x2="100%" y2="0%">
					<stop offset="0%"   stop-color="rgba(255,255,255,0.22)"/>
					<stop offset="100%" stop-color="rgba(255,255,255,0.04)"/>
				</linearGradient>
			</defs>
			<rect x="36" y="0" width="48" height="16" rx="5" fill="#363636" stroke="#0d0d0d" stroke-width="1.5"/>
			<rect x="50" y="4"  width="20" height="8"  rx="3" fill="#2a2a2a"/>
			<rect x="8" y="14" width="104" height="260" rx="14" fill="url(#hsg-${idSeguro})" stroke="#0b0b0b" stroke-width="2.5"/>
			<rect x="11" y="17" width="98"  height="4" rx="2" fill="rgba(255,255,255,0.07)"/>
			<rect x="9"  y="16" width="3"   height="256" rx="2" fill="rgba(255,255,255,0.04)"/>
			<rect x="108" y="16" width="3"  height="256" rx="2" fill="rgba(0,0,0,0.25)"/>
			<rect x="11" y="267" width="98" height="5" fill="rgba(0,0,0,0.45)"/>
			<rect x="4" y="29" width="112" height="6"  rx="3" fill="rgba(0,0,0,0.5)"/>
			<rect x="4" y="28" width="112" height="13" rx="4" fill="#1e1e1e" stroke="#0d0d0d" stroke-width="1"/>
			<rect x="6" y="40" width="108" height="2"  rx="1" fill="#131313"/>
			<circle cx="60" cy="71" r="31" fill="#0b0b0b"/>
			<circle cx="60" cy="71" r="29" fill="#0e0e0e"/>
			<circle cx="60" cy="71" r="27" fill="#141010" class="twin-led twin-red"/>
			<circle cx="60" cy="71" r="27" fill="url(#sheen-${idSeguro})" pointer-events="none"/>
			<rect x="4" y="108" width="112" height="6"  rx="3" fill="rgba(0,0,0,0.5)"/>
			<rect x="4" y="107" width="112" height="13" rx="4" fill="#1e1e1e" stroke="#0d0d0d" stroke-width="1"/>
			<rect x="6" y="119" width="108" height="2"  rx="1" fill="#131313"/>
			<circle cx="60" cy="150" r="31" fill="#0b0b0b"/>
			<circle cx="60" cy="150" r="29" fill="#0e0e0e"/>
			<circle cx="60" cy="150" r="27" fill="#131108" class="twin-led twin-yellow"/>
			<circle cx="60" cy="150" r="27" fill="url(#sheen-${idSeguro})" pointer-events="none"/>
			<rect x="4" y="187" width="112" height="6"  rx="3" fill="rgba(0,0,0,0.5)"/>
			<rect x="4" y="186" width="112" height="13" rx="4" fill="#1e1e1e" stroke="#0d0d0d" stroke-width="1"/>
			<rect x="6" y="198" width="108" height="2"  rx="1" fill="#131313"/>
			<circle cx="60" cy="229" r="31" fill="#0b0b0b"/>
			<circle cx="60" cy="229" r="29" fill="#0e0e0e"/>
			<circle cx="60" cy="229" r="27" fill="#0d1309" class="twin-led twin-green"/>
			<circle cx="60" cy="229" r="27" fill="url(#sheen-${idSeguro})" pointer-events="none"/>
			<rect x="8"  y="260" width="104" height="14" fill="#1a1a1a"/>
			<rect x="10" y="272" width="100" height="8"  rx="4" fill="#141414" stroke="#0a0a0a" stroke-width="1"/>
			<rect x="44" y="278" width="32" height="18" rx="5" fill="#242424" stroke="#0d0d0d" stroke-width="1"/>
			<rect x="52" y="294" width="16" height="72" rx="8" fill="#1e1e1e"/>
			<rect x="53" y="294" width="6"  height="72" rx="3" fill="url(#pole-${idSeguro})"/>
		</svg>
		<div class="twin-label">${rotulo}</div>
		<div><span class="twin-state-badge">Vermelho</span></div>
		<div id="countdown-${id}" class="twin-countdown">—</div>
	</div>`;
}

// ── Configuração geral ───────────────────────────────────────────────────────
const CONFIGURACAO = {
	broker: 'test.mosquitto.org',
	porta: 8080,
	turma: 'TURMA',   // ← PREENCHER
	equipe: 'EQUIPE', // ← PREENCHER
	idsDispositivos: ['sem-a', 'sem-b'],
	rotulosDispositivos: { 'sem-a': 'Semáforo A', 'sem-b': 'Semáforo B' },
	tempos: { vermelho: 5000, amarelo: 3000, verde: 5000, minimo: 1000, maximo: 60000 },
	intervaloSincronismo: 5000,
	tempoLimiteVigilancia: 15000, // RN04: tempo sem heartbeat até cair pro modo seguro
};

// Texto exibido na tela para cada estado interno
const ROTULO_ESTADO = {
	RED: 'Vermelho',
	YELLOW: 'Amarelo',
	GREEN: 'Verde',
	BLINK_YELLOW: 'Intermitente',
};

// Aceita os jeitos mais comuns de mandar um comando pelo MQTTX e devolve o nome
// usado pelo simulador ('vermelho', 'amarelo', 'verde', 'automatico', 'intermitente'):
//   {"cmd":"verde"}  {"luz":"verde"}  {"comando":"verde"}  {"estado":"GREEN"}  verde
const COMANDO_POR_SINONIMO = {
	vermelho: 'vermelho', red: 'vermelho',
	amarelo: 'amarelo', yellow: 'amarelo',
	verde: 'verde', green: 'verde',
	automatico: 'automatico', 'automático': 'automatico', auto: 'automatico',
	intermitente: 'intermitente', blink_yellow: 'intermitente', piscante: 'intermitente',
};

function normalizarComando(payload) {
	const valor = (payload && typeof payload === 'object')
		? (payload.cmd || payload.comando || payload.luz || payload.estado)
		: payload;
	if (typeof valor !== 'string') return null;
	return COMANDO_POR_SINONIMO[valor.trim().toLowerCase()] || null;
}

// Mesmo vocabulário, mas devolvendo o estado interno (RED, YELLOW, GREEN, BLINK_YELLOW)
const ESTADO_POR_COMANDO_NORMALIZADO = { vermelho: 'RED', amarelo: 'YELLOW', verde: 'GREEN', intermitente: 'BLINK_YELLOW' };

// ── Registro de comandos (RN07) ──────────────────────────────────────────────
const RegistroDeComandos = (() => {
	const LIMITE_REGISTROS = 500;
	const registros = [];

	// Guarda uma linha de histórico; o mais recente fica sempre no topo
	function registrar(idDispositivo, origem, comando, resultado, motivo) {
		const registro = {
			timestamp: new Date().toISOString(),
			idDispositivo,
			origem,
			comando,
			resultado: resultado || 'OK',
			motivo: motivo || '',
		};
		registros.unshift(registro);
		if (registros.length > LIMITE_REGISTROS) registros.pop();
		return registro;
	}

	// Devolve uma cópia do histórico (usada para inspeção pelo console)
	function listar() { return registros.slice(); }

	return { registrar, listar };
})();

window.RegistroDeComandos = RegistroDeComandos;

// ── Estado compartilhado em memória ──────────────────────────────────────────
const semaforos = {};                // idDispositivo → instância de Semaforo
const temporizadoresVigilancia = {}; // idDispositivo → timeout do watchdog
const ultimoContatoMqtt = {};        // idDispositivo → timestamp da última mensagem

// ── Atualização da tela ──────────────────────────────────────────────────────
// Acende o LED certo do SVG e atualiza o emblema com o nome do estado
function atualizarGemeoNaTela(idDispositivo, estado) {
	const elemento = document.getElementById('twin-' + idDispositivo);
	if (!elemento) return;

	elemento.dataset.state = estado;
	elemento.querySelectorAll('.twin-led').forEach((led) => led.classList.remove('ligado'));
	elemento.classList.remove('blink-yellow');

	if (estado === 'BLINK_YELLOW') {
		// A animação do CSS em .blink-yellow é quem faz o pisca-pisca
		elemento.classList.add('blink-yellow');
	} else {
		const CLASSE_DO_LED = { RED: 'twin-red', YELLOW: 'twin-yellow', GREEN: 'twin-green' };
		const classeDoLed = CLASSE_DO_LED[estado];
		if (classeDoLed) {
			const led = elemento.querySelector('.' + classeDoLed);
			if (led) led.classList.add('ligado');
		}
	}

	const emblema = elemento.querySelector('.twin-state-badge');
	if (emblema) emblema.textContent = ROTULO_ESTADO[estado] || estado;
}

// Publica o estado no sessionStorage pro painel (index.html) exibir ao vivo
function salvarEstadoDoDispositivo(idDispositivo, estado, ultimoMqtt) {
	try {
		const estados = JSON.parse(sessionStorage.getItem('estado_dispositivos') || '{}');
		estados[idDispositivo] = { estado, ultimoMqtt, ts: Date.now() };
		sessionStorage.setItem('estado_dispositivos', JSON.stringify(estados));
	} catch { /* sessionStorage indisponível — não é fatal */ }
}

// Atualiza a cada 200ms o "faltam Xs" embaixo de cada semáforo
function iniciarContagemRegressiva() {
	setInterval(() => {
		CONFIGURACAO.idsDispositivos.forEach((id) => {
			const semaforo = semaforos[id];
			if (!semaforo) return;
			const elemento = document.getElementById('countdown-' + id);
			if (!elemento) return;
			// Parado (cor fixa) ou piscando não tem próxima troca pra contar
			elemento.textContent = (!semaforo.emExecucao || semaforo.estado === 'BLINK_YELLOW')
				? '—'
				: Math.ceil(semaforo.tempoRestanteMs / 1000) + 's';
		});
	}, 200);
}

// ── Vigilância da comunicação / watchdog (RN04) ──────────────────────────────
// Cada mensagem recebida reinicia a contagem; se o dispositivo ficar mudo além
// do tempo limite, ele cai no amarelo piscante.
function reiniciarVigilanciaDoDispositivo(idDispositivo) {
	ultimoContatoMqtt[idDispositivo] = Date.now();
	clearTimeout(temporizadoresVigilancia[idDispositivo]);

	temporizadoresVigilancia[idDispositivo] = setTimeout(() => {
		const semaforo = semaforos[idDispositivo];
		if (semaforo) {
			semaforo.entrarEmModoSeguranca();
			RegistroDeComandos.registrar(idDispositivo, 'SYSTEM', 'watchdog_timeout', 'SAFE_STATE', 'RN04: sem heartbeat por 15s');
		}
		salvarEstadoDoDispositivo(idDispositivo, 'BLINK_YELLOW', ultimoContatoMqtt[idDispositivo]);
	}, CONFIGURACAO.tempoLimiteVigilancia);
}

// ── Carga inicial ────────────────────────────────────────────────────────────
// Lê os dispositivos cadastrados; sem nenhum cadastro, usa os padrões da CONFIGURACAO
function carregarDispositivosAtivos() {
	const cadastrados = window.Armazenamento ? Armazenamento.listarDispositivos() : [];

	if (cadastrados.length > 0) {
		return cadastrados.map((dispositivo) => ({
			id: dispositivo.id,
			nome: dispositivo.nome || dispositivo.id,
			tempos: {
				vermelho: dispositivo.tempoVermelho * 1000,
				amarelo: dispositivo.tempoAmarelo * 1000,
				verde: dispositivo.tempoVerde * 1000,
			},
		}));
	}

	return CONFIGURACAO.idsDispositivos.map((id) => ({
		id,
		nome: CONFIGURACAO.rotulosDispositivos[id] || id,
		tempos: CONFIGURACAO.tempos,
	}));
}

document.addEventListener('DOMContentLoaded', () => {
	const dispositivosAtivos = carregarDispositivosAtivos();
	CONFIGURACAO.idsDispositivos = dispositivosAtivos.map((dispositivo) => dispositivo.id);

	const temposPorDispositivo = {};
	dispositivosAtivos.forEach((dispositivo) => {
		temposPorDispositivo[dispositivo.id] = Object.assign({}, CONFIGURACAO.tempos, dispositivo.tempos);
	});

	// Desenha os gêmeos dinamicamente — funciona com qualquer quantidade de dispositivos
	const elementoIntersecao = document.querySelector('.twin-intersection');
	if (elementoIntersecao) {
		elementoIntersecao.innerHTML = dispositivosAtivos
			.map((dispositivo) => montarHtmlGemeo(dispositivo.id, dispositivo.nome))
			.join('');
	}

	// O cliente MQTT é criado antes dos simuladores porque o callback de mudança
	// de estado publica através dele
	const clienteMqtt = new ClienteMqtt({
		broker: CONFIGURACAO.broker,
		porta: CONFIGURACAO.porta,
		turma: CONFIGURACAO.turma,
		equipe: CONFIGURACAO.equipe,
		idsDispositivos: CONFIGURACAO.idsDispositivos,
		intervaloSincronismo: CONFIGURACAO.intervaloSincronismo,
	});
	window.clienteMqtt = clienteMqtt;

	// RN06: os simuladores rodam localmente, independentes do broker
	CONFIGURACAO.idsDispositivos.forEach((id) => {
		const semaforo = new Semaforo(id, temposPorDispositivo[id] || CONFIGURACAO.tempos,
			(idDispositivo, novoEstado, estadoAnterior) => {
				atualizarGemeoNaTela(idDispositivo, novoEstado);
				salvarEstadoDoDispositivo(idDispositivo, novoEstado, ultimoContatoMqtt[idDispositivo]);

				// As piscadas do intermitente repetem o mesmo estado a cada 500ms: são
				// só visuais, não viram histórico (RN07) nem mensagem no broker.
				const ehPiscadaDoIntermitente = novoEstado === 'BLINK_YELLOW' && estadoAnterior === 'BLINK_YELLOW';
				if (ehPiscadaDoIntermitente) return;

				RegistroDeComandos.registrar(idDispositivo, 'SIMULATOR', novoEstado, 'OK', '');

				// Publica o estado no broker quando houver conexão
				if (clienteMqtt.conectado) {
					clienteMqtt.publicar(idDispositivo, 'estado', {
						estado: novoEstado,
						origem: 'gemeo-web', // marca pra outras abas não repintarem a tela com isso
						ts: Date.now(),
						tempoRestanteMs: semaforos[idDispositivo] ? semaforos[idDispositivo].tempoRestanteMs : 0,
					});
				}
			});

		// Os semáforos do cruzamento são controlados por MQTT: nascem fechados e
		// parados, e só se mexem quando chega um comando no tópico do dispositivo
		semaforo.definirEstadoInicial('RED');

		semaforos[id] = semaforo;
	});

	iniciarContagemRegressiva();

	// ── Ciclo de vida da conexão MQTT ────────────────────────────────────────
	clienteMqtt.aoConectar = () => {
		RegistroDeComandos.registrar('SISTEMA', 'SYSTEM', 'mqtt_connect', 'OK', 'Broker online');
		CONFIGURACAO.idsDispositivos.forEach((id) => {
			['estado', 'comando', 'configuracao', 'falha', 'sincronizacao'].forEach((sufixo) => {
				clienteMqtt.assinar(id, sufixo);
			});
		});
	};

	clienteMqtt.aoDesconectar = () => {
		RegistroDeComandos.registrar('SISTEMA', 'SYSTEM', 'mqtt_disconnect', 'SAFE_STATE', 'RN04: conexão perdida');
		CONFIGURACAO.idsDispositivos.forEach((id) => {
			if (semaforos[id]) semaforos[id].entrarEmModoSeguranca();
			salvarEstadoDoDispositivo(id, 'BLINK_YELLOW', ultimoContatoMqtt[id]);
		});
	};

	clienteMqtt.aoReceberMensagem = (idDispositivo, sufixo, payload) => {
		if (!CONFIGURACAO.idsDispositivos.includes(idDispositivo)) return;
		reiniciarVigilanciaDoDispositivo(idDispositivo);

		const semaforo = semaforos[idDispositivo];
		if (!semaforo) return;

		if (sufixo === 'sincronizacao') {
			salvarEstadoDoDispositivo(idDispositivo, semaforo.estado, ultimoContatoMqtt[idDispositivo]);
			return;
		}

		if (sufixo === 'estado') {
			// Estado publicado por um gêmeo web (esta ou outra aba aberta) não manda na tela;
			// só o que vem do dispositivo real / MQTTX é espelhado
			if (payload && payload.origem === 'gemeo-web') return;
			const comandoDoEstado = normalizarComando(payload);
			const estado = ESTADO_POR_COMANDO_NORMALIZADO[comandoDoEstado];
			if (estado) atualizarGemeoNaTela(idDispositivo, estado);
			return;
		}

		if (sufixo === 'comando') {
			const comando = normalizarComando(payload);
			if (!comando) {
				console.warn(`[MQTT] comando não reconhecido em ${idDispositivo}:`, payload,
					'— use {"cmd":"vermelho|amarelo|verde|automatico|intermitente"}');
				RegistroDeComandos.registrar(idDispositivo, 'MQTT', 'cmd:?', 'IGNORADO', JSON.stringify(payload));
				return;
			}

			// 'automatico' e 'intermitente' trocam o modo de operação e cuidam dos
			// próprios temporizadores. Comando de cor trava o semáforo nessa cor
			// até chegar outro comando — o parar() é o que impede o ciclo
			// automático de retomar sozinho por baixo.
			if (comando !== 'automatico' && comando !== 'intermitente') semaforo.parar();
			semaforo.aplicarComando(comando);

			RegistroDeComandos.registrar(idDispositivo, 'MQTT', `cmd:${comando}`, 'OK', '');
			return;
		}

		// Configuração e falha precisam de JSON; texto puro aqui é ignorado
		if (typeof payload !== 'object' || payload === null) return;

		if (sufixo === 'configuracao') {
			semaforo.definirTempos(payload);
			// Se estiver no ciclo automático, a cor atual já passa a contar com o tempo novo
			if (semaforo.emExecucao && semaforo.estado !== 'BLINK_YELLOW') semaforo.reiniciarFaseAtual();

			// Guarda no cadastro (em segundos) pra configuração sobreviver a um recarregamento
			const cadastrado = window.Armazenamento
				? Armazenamento.listarDispositivos().find((d) => d.id === idDispositivo)
				: null;
			if (cadastrado) {
				Armazenamento.salvarDispositivo(Object.assign({}, cadastrado, {
					tempoVermelho: semaforo.tempos.vermelho / 1000,
					tempoAmarelo: semaforo.tempos.amarelo / 1000,
					tempoVerde: semaforo.tempos.verde / 1000,
				}));
			}

			console.log(`[MQTT] tempos de ${idDispositivo} (ms):`, semaforo.tempos);
			RegistroDeComandos.registrar(idDispositivo, 'MQTT', 'configurar', 'OK', JSON.stringify(payload));
			return;
		}

		if (sufixo === 'falha') {
			semaforo.entrarEmModoSeguranca();
			RegistroDeComandos.registrar(idDispositivo, 'MQTT', `falha:${payload.luz || '?'}`, 'SAFE_STATE', 'RN09: falha de luz');
			salvarEstadoDoDispositivo(idDispositivo, 'BLINK_YELLOW', ultimoContatoMqtt[idDispositivo]);
		}
	};

	clienteMqtt.conectar();
});
