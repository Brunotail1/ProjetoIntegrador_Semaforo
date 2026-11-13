'use strict';

const crypto = require('crypto');
const banco = require('./banco');
const { DURACAO_SESSAO_MS } = require('./config');

const consultas = {
	inserir: banco.prepare('INSERT INTO sessoes (token_hash, usuario_id, expira_em) VALUES (?, ?, ?)'),
	buscarUsuario: banco.prepare(`
		SELECT u.id, u.nome, u.email, u.role
		FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
		WHERE s.token_hash = ? AND s.expira_em > ?
	`),
	excluir: banco.prepare('DELETE FROM sessoes WHERE token_hash = ?'),
	excluirExpiradas: banco.prepare('DELETE FROM sessoes WHERE expira_em <= ?'),
};

// O banco guarda só o hash do token: quem ler o arquivo não consegue usar a sessão
const hashDoToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function abrirSessao(idUsuario) {
	const agora = Date.now();
	consultas.excluirExpiradas.run(agora);
	const token = crypto.randomBytes(32).toString('hex');
	consultas.inserir.run(hashDoToken(token), idUsuario, agora + DURACAO_SESSAO_MS);
	return token;
}

function encerrarSessao(token) {
	consultas.excluir.run(hashDoToken(token));
}

function tokenDaRequisicao(req) {
	const [tipo, token] = (req.headers.authorization || '').split(' ');
	return tipo === 'Bearer' ? token : null;
}

// O perfil vem do banco a cada requisição: mudar o papel de alguém vale na hora
function exigirLogin(req, res, next) {
	const token = tokenDaRequisicao(req);
	const usuario = token ? consultas.buscarUsuario.get(hashDoToken(token), Date.now()) : null;
	if (!usuario) return res.status(401).json({ erro: 'Sessão inválida ou expirada.' });
	req.usuario = usuario;
	req.token = token;
	next();
}

function exigirAdmin(req, res, next) {
	if (req.usuario.role !== 'admin') return res.status(403).json({ erro: 'Acesso restrito a administradores.' });
	next();
}

module.exports = { abrirSessao, encerrarSessao, exigirLogin, exigirAdmin };
