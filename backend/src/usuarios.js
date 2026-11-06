'use strict';

const crypto = require('crypto');
const banco = require('./banco');
const { gerarHashDeSenha } = require('./senhas');

const SENHA_MINIMA = 4;
const SENHA_MAXIMA = 64;
const PERFIS = ['admin', 'operador'];

const consultas = {
	listar: banco.prepare('SELECT id, nome, email, role FROM usuarios ORDER BY nome'),
	buscar: banco.prepare('SELECT id, nome, email, role, senha_hash FROM usuarios WHERE id = ?'),
	buscarPorEmail: banco.prepare('SELECT id, nome, email, role, senha_hash FROM usuarios WHERE email = ?'),
	inserir: banco.prepare('INSERT INTO usuarios (id, nome, email, senha_hash, role) VALUES (?, ?, ?, ?, ?)'),
	atualizar: banco.prepare('UPDATE usuarios SET nome = ?, email = ?, role = ?, senha_hash = ? WHERE id = ?'),
	excluir: banco.prepare('DELETE FROM usuarios WHERE id = ?'),
	contar: banco.prepare('SELECT COUNT(*) AS total FROM usuarios'),
	contarAdmins: banco.prepare("SELECT COUNT(*) AS total FROM usuarios WHERE role = 'admin'"),
	encerrarSessoes: banco.prepare('DELETE FROM sessoes WHERE usuario_id = ?'),
};

// Nunca devolve o hash da senha pra fora do back-end
const paraJson = ({ id, nome, email, role }) => ({ id, nome, email, role });

// Devolve a mensagem de erro, ou null quando está tudo certo
function validar({ nome, email, role, senha }, ehNovo) {
	if (typeof nome !== 'string' || !nome.trim() || nome.trim().length > 60) return 'O nome é obrigatório (até 60 caracteres).';
	if (typeof email !== 'string' || email.trim().length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Informe um e-mail válido.';
	if (!PERFIS.includes(role)) return 'Perfil inválido.';
	if (ehNovo && !senha) return 'A senha é obrigatória para novos usuários.';
	if (senha !== undefined && senha !== '' &&
		(typeof senha !== 'string' || senha.length < SENHA_MINIMA || senha.length > SENHA_MAXIMA)) {
		return `A senha deve ter entre ${SENHA_MINIMA} e ${SENHA_MAXIMA} caracteres.`;
	}
	return null;
}

function emailEmUso(email, idIgnorado) {
	const existente = consultas.buscarPorEmail.get(email);
	return !!existente && existente.id !== idIgnorado;
}

function criar({ nome, email, role, senha }) {
	const id = crypto.randomUUID();
	consultas.inserir.run(id, nome.trim(), email.trim(), gerarHashDeSenha(senha), role);
	return paraJson(consultas.buscar.get(id));
}

// Senha em branco mantém a atual; senha nova derruba as sessões abertas do usuário
function atualizar(id, { nome, email, role, senha }) {
	const atual = consultas.buscar.get(id);
	const senhaHash = senha ? gerarHashDeSenha(senha) : atual.senha_hash;
	consultas.atualizar.run(nome.trim(), email.trim(), role, senhaHash, id);
	if (senha) consultas.encerrarSessoes.run(id);
	return paraJson(consultas.buscar.get(id));
}

module.exports = {
	validar,
	emailEmUso,
	criar,
	atualizar,
	paraJson,
	listar: () => consultas.listar.all(),
	buscar: (id) => consultas.buscar.get(id),
	buscarPorEmail: (email) => consultas.buscarPorEmail.get(email),
	excluir: (id) => consultas.excluir.run(id),
	contar: () => consultas.contar.get().total,
	contarAdmins: () => consultas.contarAdmins.get().total,
};
