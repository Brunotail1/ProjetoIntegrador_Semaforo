'use strict';

const express = require('express');
const path = require('path');

const rotasPainel = require('./rotas/painel');
const rotasSemaforos = require('./rotas/semaforos');
const rotasSessao = require('./rotas/sessao');
const rotasUsuarios = require('./rotas/usuarios');

const RAIZ_DO_PROJETO = path.join(__dirname, '..', '..');
const PAGINAS = ['index.html', 'login.html', 'gemeos.html', 'semaforos.html', 'usuarios.html'];

// O front pode vir do Live Server (outra porta), mas sempre da própria máquina
const ORIGEM_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function liberarOrigemLocal(req, res, next) {
	const origem = req.headers.origin;
	if (origem && ORIGEM_LOCAL.test(origem)) {
		res.set({
			'Access-Control-Allow-Origin': origem,
			'Access-Control-Allow-Headers': 'Authorization, Content-Type',
			'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
			Vary: 'Origin',
		});
	}
	if (req.method === 'OPTIONS') return res.status(204).end();
	next();
}

function criarApp() {
	const app = express();
	app.use(liberarOrigemLocal);
	app.use(express.json());

	app.use(rotasSessao);
	app.use(rotasPainel);
	app.use('/usuarios', rotasUsuarios);
	app.use('/semaforos', rotasSemaforos);

	// Só as páginas e os assets: servir a raiz inteira exporia a pasta backend e o .git
	app.get('/', (req, res) => res.sendFile(path.join(RAIZ_DO_PROJETO, 'index.html')));
	PAGINAS.forEach((pagina) => {
		app.get(`/${pagina}`, (req, res) => res.sendFile(path.join(RAIZ_DO_PROJETO, pagina)));
	});
	app.use('/assets', express.static(path.join(RAIZ_DO_PROJETO, 'assets')));
	app.use('/images', express.static(path.join(RAIZ_DO_PROJETO, 'images')));
	app.use('/console', express.static(path.join(__dirname, '..', 'public'))); // tela de teste do MQTT

	app.use((req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

	// O Express só reconhece o tratador de erros pelos 4 parâmetros
	app.use((erro, req, res, next) => {
		if (erro.type === 'entity.parse.failed') return res.status(400).json({ erro: 'JSON inválido.' });
		console.log('Erro na API:', erro);
		res.status(500).json({ erro: 'Erro interno do servidor.' });
	});

	return app;
}

module.exports = { criarApp };
