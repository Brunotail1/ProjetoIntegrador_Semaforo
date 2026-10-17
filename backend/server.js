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
const { DatabaseSync } = require('node:sqlite'); // SQLite já vem embutido no Node 22.5+

const TURMA = 'TURMA';   // mesmo valor usado no aplicacao.js importado em equipe e turma
const EQUIPE = 'EQUIPE'; 
const BASE = `aps1/semaforo/${TURMA}/${EQUIPE}`;

// Status recebido de cada semáforo fica salvo no arquivo banco.db (SQLite)
const banco = new DatabaseSync(__dirname + '/banco.db');
banco.exec(`
	CREATE TABLE IF NOT EXISTS estados (
		id            INTEGER PRIMARY KEY AUTOINCREMENT,
		id_dispositivo TEXT NOT NULL,
		estado        TEXT,
		payload       TEXT NOT NULL,
		recebido_em   TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
	);
	CREATE TABLE IF NOT EXISTS falhas (
		id            INTEGER PRIMARY KEY AUTOINCREMENT,
		id_dispositivo TEXT NOT NULL,
		luz           TEXT,
		payload       TEXT NOT NULL,
		recebido_em   TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
	);
`);

const inserirEstado = banco.prepare('INSERT INTO estados (id_dispositivo, estado, payload) VALUES (?, ?, ?)');
const inserirFalha = banco.prepare('INSERT INTO falhas (id_dispositivo, luz, payload) VALUES (?, ?, ?)');
const ultimoEstado = banco.prepare('SELECT payload, recebido_em FROM estados WHERE id_dispositivo = ? ORDER BY id DESC LIMIT 1');
const listarFalhas = banco.prepare('SELECT payload, recebido_em FROM falhas WHERE id_dispositivo = ? ORDER BY id');

// Converte uma linha do banco de volta para o JSON recebido + data de recebimento
const linhaParaJson = (linha) => ({ ...JSON.parse(linha.payload), recebidoEm: linha.recebido_em });

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

	const texto = JSON.stringify(payload);
	if (sufixo === 'estado') inserirEstado.run(idDispositivo, String(payload.estado ?? ''), texto);
	if (sufixo === 'falha') inserirFalha.run(idDispositivo, String(payload.luz ?? ''), texto);
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
	const estado = ultimoEstado.get(id);
	res.json({
		situacao: estado ? linhaParaJson(estado) : null,
		falhas: listarFalhas.all(id).map(linhaParaJson),
	});
});

app.listen(3001, () => console.log('API em http://localhost:3000'));
