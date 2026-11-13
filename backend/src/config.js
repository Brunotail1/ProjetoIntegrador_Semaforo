'use strict';

const os = require('os');
const path = require('path');

// Mesmos valores usados no aplicacao.js (turma e equipe entram nos tópicos MQTT)
const TURMA = process.env.TURMA || 'TURMA';
const EQUIPE = process.env.EQUIPE || 'EQUIPE';

module.exports = {
	PORTA: Number(process.env.PORTA) || 3000,

	// O banco fica FORA da pasta do projeto: dentro dela, o Live Server do VS Code
	// recarregava o gemeos.html a cada gravação. Dá pra trocar com a variável BANCO_DB.
	CAMINHO_BANCO: process.env.BANCO_DB || path.join(os.homedir(), '.semaforo', 'banco.db'),

	URL_MQTT: process.env.MQTT_URL || 'mqtt://test.mosquitto.org:1883',
	BASE_MQTT: `aps1/semaforo/${TURMA}/${EQUIPE}`,
	ORIGEM_BACKEND: 'backend', // marca no payload o que o próprio back-end publicou

	DURACAO_SESSAO_MS: 8 * 60 * 60 * 1000,

	// RN05: limites do tempo de cada cor, em segundos
	TEMPO_MINIMO: 1,
	TEMPO_MAXIMO: 60,
};
