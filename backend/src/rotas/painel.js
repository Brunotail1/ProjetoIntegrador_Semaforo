'use strict';

const express = require('express');
const { exigirLogin } = require('../autenticacao');
const registros = require('../registros');
const semaforos = require('../semaforos');
const usuarios = require('../usuarios');

const rotas = express.Router();
rotas.use(['/painel', '/comandos'], exigirLogin);

// Resumo do painel: operador vê os totais sem ter acesso à lista de usuários
rotas.get('/painel', (req, res) => {
	res.json({
		totalSemaforos: semaforos.contar(),
		totalUsuarios: usuarios.contar(),
		statusAoVivo: semaforos.statusAoVivo(),
	});
});

// RN07: histórico de comandos — filtros opcionais ?dispositivo=sem-a&limite=50
rotas.get('/comandos', (req, res) => {
	res.json(registros.listarComandos(req.query.dispositivo, req.query.limite));
});

module.exports = rotas;
