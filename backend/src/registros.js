'use strict';

const banco = require('./banco');

const LIMITE_FALHAS = 100;
const LIMITE_PADRAO_COMANDOS = 100;
const LIMITE_MAXIMO_COMANDOS = 500;

const consultas = {
	inserirEstado: banco.prepare('INSERT INTO estados (id_dispositivo, estado, payload) VALUES (?, ?, ?)'),
	inserirFalha: banco.prepare('INSERT INTO falhas (id_dispositivo, luz, payload) VALUES (?, ?, ?)'),
	inserirComando: banco.prepare(`
		INSERT INTO comandos (id_dispositivo, origem, comando, resultado, motivo, usuario) VALUES (?, ?, ?, ?, ?, ?)
	`),
	ultimoEstado: banco.prepare('SELECT payload, recebido_em FROM estados WHERE id_dispositivo = ? ORDER BY id DESC LIMIT 1'),
	listarFalhas: banco.prepare(`SELECT payload, recebido_em FROM falhas WHERE id_dispositivo = ? ORDER BY id DESC LIMIT ${LIMITE_FALHAS}`),
	listarComandos: banco.prepare(`
		SELECT id_dispositivo AS idDispositivo, origem, comando, resultado, motivo, usuario, criado_em AS criadoEm
		FROM comandos ORDER BY id DESC LIMIT ?
	`),
	listarComandosDoDispositivo: banco.prepare(`
		SELECT id_dispositivo AS idDispositivo, origem, comando, resultado, motivo, usuario, criado_em AS criadoEm
		FROM comandos WHERE id_dispositivo = ? ORDER BY id DESC LIMIT ?
	`),
};

// Converte uma linha do banco de volta para o JSON recebido + data de recebimento
const linhaParaJson = (linha) => ({ ...JSON.parse(linha.payload), recebidoEm: linha.recebido_em });

function registrarComando({ idDispositivo, origem, comando, resultado = 'OK', motivo = '', usuario = null }) {
	consultas.inserirComando.run(idDispositivo, origem, comando, resultado, motivo, usuario);
}

function listarComandos(idDispositivo, limite) {
	const quantidade = Math.min(Math.max(1, Number(limite) || LIMITE_PADRAO_COMANDOS), LIMITE_MAXIMO_COMANDOS);
	return idDispositivo
		? consultas.listarComandosDoDispositivo.all(idDispositivo, quantidade)
		: consultas.listarComandos.all(quantidade);
}

function statusDoDispositivo(idDispositivo) {
	const estado = consultas.ultimoEstado.get(idDispositivo);
	return {
		situacao: estado ? linhaParaJson(estado) : null,
		falhas: consultas.listarFalhas.all(idDispositivo).map(linhaParaJson),
	};
}

module.exports = {
	registrarComando,
	listarComandos,
	statusDoDispositivo,
	registrarEstado: (id, estado, texto) => consultas.inserirEstado.run(id, estado, texto),
	registrarFalha: (id, luz, texto) => consultas.inserirFalha.run(id, luz, texto),
};
