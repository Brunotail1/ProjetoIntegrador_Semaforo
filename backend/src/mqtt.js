'use strict';

/*
 * Integração com MQTT. Padrão dos tópicos (o mesmo do front):
 * aps1/semaforo/<turma>/<equipe>/<idDispositivo>/<sufixo>
 *
 * Back-end → semáforo: .../configuracao  {"vermelho":5,"amarelo":3,"verde":5}  (segundos)
 * Back-end → semáforo: .../comando       {"cmd":"verde"}
 * Semáforo → back-end: .../estado        {"estado":"GREEN"}
 * Semáforo → back-end: .../falha         {"luz":"vermelho"}
 *
 * O back-end também escuta comando e configuração publicados por fora (MQTTX),
 * pra entrarem no histórico (RN07) e os tempos novos ficarem salvos no cadastro.
 */

const mqtt = require('mqtt');
const { BASE_MQTT, ORIGEM_BACKEND, TEMPO_MINIMO, TEMPO_MAXIMO, URL_MQTT } = require('./config');
const registros = require('./registros');
const semaforos = require('./semaforos');

const SUFIXOS_ESCUTADOS = ['estado', 'falha', 'comando', 'configuracao'];
const POSICAO_DISPOSITIVO = BASE_MQTT.split('/').length;

let cliente = null;

const montarTopico = (idDispositivo, sufixo) => `${BASE_MQTT}/${idDispositivo}/${sufixo}`;

// Mesma regra do simulador: valor fora do limite é ajustado; ausente mantém o atual
function limitarTempo(valor, atual) {
	const segundos = Number(valor);
	if (valor === undefined || valor === '' || !Number.isFinite(segundos)) return atual;
	return Math.min(TEMPO_MAXIMO, Math.max(TEMPO_MINIMO, segundos));
}

function salvarConfiguracaoRecebida(idDispositivo, payload) {
	const semaforo = semaforos.buscar(idDispositivo);
	if (semaforo) {
		semaforos.atualizarTempos(idDispositivo,
			limitarTempo(payload.vermelho, semaforo.tempoVermelho),
			limitarTempo(payload.amarelo, semaforo.tempoAmarelo),
			limitarTempo(payload.verde, semaforo.tempoVerde));
	}
	registros.registrarComando({
		idDispositivo, origem: 'MQTT', comando: 'configurar', motivo: JSON.stringify(payload),
		resultado: semaforo ? 'OK' : 'IGNORADO',
	});
}

function registrarComandoRecebido(idDispositivo, payload) {
	const comando = typeof payload === 'object'
		? (payload.cmd || payload.comando || payload.luz || payload.estado)
		: payload;
	registros.registrarComando({ idDispositivo, origem: 'MQTT', comando: `cmd:${comando ?? '?'}` });
}

function processarMensagem(topico, mensagem) {
	const partes = topico.split('/');
	const idDispositivo = partes[POSICAO_DISPOSITIVO];
	const sufixo = partes[POSICAO_DISPOSITIVO + 1];

	let payload;
	try {
		payload = JSON.parse(mensagem.toString());
	} catch {
		payload = mensagem.toString().trim(); // ex.: "verde" digitado em Plaintext no MQTTX
	}

	const ehObjeto = !!payload && typeof payload === 'object';
	if (ehObjeto && payload.origem === ORIGEM_BACKEND) return; // eco do que o próprio back-end publicou

	// Só comando aceita texto puro; o resto do protocolo é JSON
	if (sufixo === 'comando' ? !payload : !ehObjeto) return;

	const texto = JSON.stringify(payload);
	try {
		if (sufixo === 'estado') registros.registrarEstado(idDispositivo, String(payload.estado ?? ''), texto);
		if (sufixo === 'falha') registros.registrarFalha(idDispositivo, String(payload.luz ?? ''), texto);
		if (sufixo === 'comando') registrarComandoRecebido(idDispositivo, payload);
		if (sufixo === 'configuracao') salvarConfiguracaoRecebida(idDispositivo, payload);
	} catch (erro) {
		console.log('Erro ao gravar no banco:', erro.message); // não derruba o servidor
		return;
	}
	console.log(`[recebido] ${idDispositivo}/${sufixo}`, payload);
}

function conectarMqtt() {
	// queueQoSZero: sem isso, comandos antigos seriam entregues ao semáforo só na reconexão
	cliente = mqtt.connect(URL_MQTT, { queueQoSZero: false });

	cliente.on('connect', () => {
		// O '+' assina o tópico de qualquer semáforo
		SUFIXOS_ESCUTADOS.forEach((sufixo) => cliente.subscribe(`${BASE_MQTT}/+/${sufixo}`));
		console.log('Back-end conectado ao broker MQTT');
	});
	cliente.on('error', (erro) => console.log('Erro no MQTT:', erro.message));
	cliente.on('message', processarMensagem);
}

// Devolve false se o broker estiver fora; quem chama decide o que dizer ao usuário
function publicar(idDispositivo, sufixo, payload) {
	if (!cliente || !cliente.connected) return false;
	const topico = montarTopico(idDispositivo, sufixo);
	cliente.publish(topico, JSON.stringify({ ...payload, origem: ORIGEM_BACKEND }));
	console.log(`[enviado] ${topico}`, payload);
	return true;
}

module.exports = { conectarMqtt, publicar, processarMensagem, montarTopico };
