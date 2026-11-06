'use strict';

const express = require('express');
const { abrirSessao, encerrarSessao, exigirLogin } = require('../autenticacao');
const { senhaConfere } = require('../senhas');
const usuarios = require('../usuarios');

const rotas = express.Router();

rotas.post('/login', (req, res) => {
	const { email, senha } = req.body;
	if (typeof email !== 'string' || typeof senha !== 'string' || !email.trim() || !senha) {
		return res.status(400).json({ erro: 'Preencha e-mail e senha.' });
	}

	const usuario = usuarios.buscarPorEmail(email.trim());
	if (!usuario || !senhaConfere(senha, usuario.senha_hash)) {
		return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
	}

	res.json({ ...usuarios.paraJson(usuario), token: abrirSessao(usuario.id) });
});

rotas.post('/logout', exigirLogin, (req, res) => {
	encerrarSessao(req.token);
	res.status(204).end();
});

rotas.get('/sessao', exigirLogin, (req, res) => res.json(req.usuario));

module.exports = rotas;
