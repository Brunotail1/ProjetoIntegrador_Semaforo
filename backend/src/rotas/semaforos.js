'use strict';

const express = require('express');
const { exigirLogin, exigirAdmin } = require('../autenticacao');
const { publicar, montarTopico } = require('../mqtt');
const registros = require('../registros');
const semaforos = require('../semaforos');

const COMANDOS = ['vermelho', 'amarelo', 'verde', 'automatico', 'intermitente'];

const rotas = express.Router();
rotas.use(exigirLogin);

// Carrega o semáforo do :id, ou responde 404
function exigirSemaforo(req, res, next) {
	req.semaforo = semaforos.buscar(req.params.id);
	if (!req.semaforo) return res.status(404).json({ erro: 'Semáforo não encontrado.' });
	next();
}

// Envia os tempos ao semáforo e registra no histórico (RN07)
function enviarConfiguracao(idDispositivo, vermelho, amarelo, verde, usuario) {
	const enviado = publicar(idDispositivo, 'configuracao', { vermelho, amarelo, verde });
	registros.registrarComando({
		idDispositivo, origem: 'API', comando: 'configurar', usuario,
		motivo: JSON.stringify({ vermelho, amarelo, verde }),
		resultado: enviado ? 'OK' : 'NAO_ENVIADO',
	});
	return enviado;
}

rotas.get('/', (req, res) => res.json(semaforos.listar()));

rotas.post('/', exigirAdmin, (req, res) => {
	const erro = semaforos.validarId(req.body.id) || semaforos.validarDados(req.body);
	if (erro) return res.status(400).json({ erro });
	if (semaforos.buscar(req.body.id)) {
		return res.status(409).json({ erro: `Já existe um semáforo com o ID "${req.body.id}".` });
	}
	res.status(201).json(semaforos.criar(req.body.id, req.body));
});

rotas.get('/:id', exigirSemaforo, (req, res) => res.json(req.semaforo));

rotas.put('/:id', exigirAdmin, exigirSemaforo, (req, res) => {
	const erro = semaforos.validarDados(req.body);
	if (erro) return res.status(400).json({ erro });

	const anterior = req.semaforo;
	const atualizado = semaforos.atualizar(anterior.id, req.body);

	// Tempo novo no cadastro já vale pro semáforo que está rodando
	const temposMudaram = anterior.tempoVermelho !== atualizado.tempoVermelho ||
		anterior.tempoAmarelo !== atualizado.tempoAmarelo ||
		anterior.tempoVerde !== atualizado.tempoVerde;
	if (temposMudaram) {
		enviarConfiguracao(atualizado.id, atualizado.tempoVermelho, atualizado.tempoAmarelo,
			atualizado.tempoVerde, req.usuario.email);
	}
	res.json(atualizado);
});

// O histórico (estados, falhas, comandos) continua no banco depois da exclusão
rotas.delete('/:id', exigirAdmin, exigirSemaforo, (req, res) => {
	semaforos.excluir(req.semaforo.id);
	res.status(204).end();
});

// Back-end envia configurações ao semáforo e guarda no cadastro
rotas.post('/:id/configuracao', exigirAdmin, exigirSemaforo, (req, res) => {
	const { vermelho, amarelo, verde } = req.body;
	const erro = semaforos.validarTempos(vermelho, amarelo, verde);
	if (erro) return res.status(400).json({ erro });

	semaforos.atualizarTempos(req.semaforo.id, vermelho, amarelo, verde);
	const enviado = enviarConfiguracao(req.semaforo.id, vermelho, amarelo, verde, req.usuario.email);
	res.status(enviado ? 200 : 202).json({ enviado, topico: montarTopico(req.semaforo.id, 'configuracao') });
});

// Comando vale só pro momento: se o broker estiver fora, falha em vez de guardar
rotas.post('/:id/comando', exigirSemaforo, (req, res) => {
	const { cmd } = req.body;
	if (!COMANDOS.includes(cmd)) {
		return res.status(400).json({ erro: `Comando inválido. Use: ${COMANDOS.join(', ')}.` });
	}

	const enviado = publicar(req.semaforo.id, 'comando', { cmd });
	registros.registrarComando({
		idDispositivo: req.semaforo.id, origem: 'API', comando: `cmd:${cmd}`, usuario: req.usuario.email,
		resultado: enviado ? 'OK' : 'NAO_ENVIADO',
	});
	if (!enviado) return res.status(503).json({ erro: 'Broker MQTT indisponível. O comando não foi enviado.' });
	res.json({ enviado, topico: montarTopico(req.semaforo.id, 'comando') });
});

// Consulta o que o back-end recebeu do semáforo. Não exige cadastro: o histórico
// de um semáforo excluído continua consultável.
rotas.get('/:id/status', (req, res) => res.json(registros.statusDoDispositivo(req.params.id)));

module.exports = rotas;
