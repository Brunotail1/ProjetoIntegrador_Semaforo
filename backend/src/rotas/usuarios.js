'use strict';

const express = require('express');
const { exigirLogin, exigirAdmin } = require('../autenticacao');
const usuarios = require('../usuarios');

const rotas = express.Router();
rotas.use(exigirLogin, exigirAdmin);

const ehUltimoAdmin = (usuario) => usuario.role === 'admin' && usuarios.contarAdmins() === 1;

rotas.get('/', (req, res) => res.json(usuarios.listar()));

rotas.post('/', (req, res) => {
	const erro = usuarios.validar(req.body, true);
	if (erro) return res.status(400).json({ erro });
	if (usuarios.emailEmUso(req.body.email.trim())) {
		return res.status(409).json({ erro: 'Já existe um usuário com esse e-mail.' });
	}
	res.status(201).json(usuarios.criar(req.body));
});

rotas.put('/:id', (req, res) => {
	const usuario = usuarios.buscar(req.params.id);
	if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });

	const erro = usuarios.validar(req.body, false);
	if (erro) return res.status(400).json({ erro });
	if (usuarios.emailEmUso(req.body.email.trim(), usuario.id)) {
		return res.status(409).json({ erro: 'Já existe um usuário com esse e-mail.' });
	}
	if (ehUltimoAdmin(usuario) && req.body.role !== 'admin') {
		return res.status(409).json({ erro: 'O sistema precisa de pelo menos um administrador.' });
	}
	res.json(usuarios.atualizar(usuario.id, req.body));
});

rotas.delete('/:id', (req, res) => {
	const usuario = usuarios.buscar(req.params.id);
	if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });
	if (usuario.id === req.usuario.id) {
		return res.status(409).json({ erro: 'Você não pode excluir seu próprio usuário.' });
	}
	usuarios.excluir(usuario.id);
	res.status(204).end();
});

module.exports = rotas;
