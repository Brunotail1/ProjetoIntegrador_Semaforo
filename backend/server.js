'use strict';

/*
 * Back-end do semáforo — integração com MQTT.
 * Padrão dos tópicos (o mesmo do front): aps1/semaforo/<turma>/<equipe>/<idDispositivo>/<sufixo>
 *
 * Back-end → semáforo: .../configuracao  {"vermelho":5,"amarelo":3,"verde":5}  (segundos)
 * Semáforo → back-end: .../estado        {"estado":"GREEN"}
 * Semáforo → back-end: .../falha         {"luz":"vermelho"}
 */

const express = require('express');
const mqtt = require('mqtt');

const TURMA = 'TURMA';   // mesmo valor usado no aplicacao.js importado em equipe e turma
const EQUIPE = 'EQUIPE'; 
const BASE = `aps1/semaforo/${TURMA}/${EQUIPE}`;

// Último status recebido de cada semáforo (fica em memória)
const situacao = {}; // idDispositivo → { estado }
const falhas = {};   // idDispositivo → [ { luz }]

// ── Item 1: integração do back-end com MQTT ──────────────────────────────────
const cliente = mqtt.connect('mqtt://test.mosquitto.org:1883');

cliente.on('connect', () => {
	// back-end recebe status do dispositivo
	// O '+' assina o tópico de qualquer semáforo
	cliente.subscribe(`${BASE}/+/estado`); // situação atual
	cliente.subscribe(`${BASE}/+/falha`);  // falhas
	console.log('Back-end conectado ao broker MQTT');
});

cliente.on('error', (erro) => console.log('Erro no MQTT:', erro.message));

cliente.on('message', (topico, mensagem) => {
	const partes = topico.split('/');
	const idDispositivo = partes[4];
	const sufixo = partes[5];

	let payload;
	try {
		payload = JSON.parse(mensagem.toString());
	} catch {
		return; // ignora payloads mal formatados
	}

	if (sufixo === 'estado') situacao[idDispositivo] = payload;
	if (sufixo === 'falha') {
		if (!falhas[idDispositivo]) falhas[idDispositivo] = [];
		falhas[idDispositivo].push(payload);
	}
	console.log(`[recebido] ${idDispositivo}/${sufixo}`, payload);
});

const app = express();
app.use(express.json());
app.use(express.static(__dirname + '/public')); // tela simples em http://localhost:3000

// back-end envia configurações ao semáforo 
app.post('/semaforos/:id/configuracao', (req, res) => {
	const { vermelho, amarelo, verde } = req.body;
	const topico = `${BASE}/${req.params.id}/configuracao`;
	cliente.publish(topico, JSON.stringify({ vermelho, amarelo, verde }));
	console.log(`[enviado] ${topico}`, { vermelho, amarelo, verde });
	res.json({ enviado: true, topico });
});

// Consulta o que o back-end recebeu do semáforo 
app.get('/semaforos/:id/status', (req, res) => {
	const id = req.params.id;
	res.json({ situacao: situacao[id] || null, falhas: falhas[id] || [] });
});

app.listen(3000, () => console.log('API em http://localhost:3000'));
