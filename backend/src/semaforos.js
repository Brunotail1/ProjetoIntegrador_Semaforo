'use strict';

const banco = require('./banco');
const { TEMPO_MINIMO, TEMPO_MAXIMO } = require('./config');

const consultas = {
	listar: banco.prepare('SELECT * FROM semaforos ORDER BY id'),
	buscar: banco.prepare('SELECT * FROM semaforos WHERE id = ?'),
	inserir: banco.prepare(`
		INSERT INTO semaforos (id, nome, localizacao, turma, equipe, tempo_vermelho, tempo_amarelo, tempo_verde)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`),
	atualizar: banco.prepare(`
		UPDATE semaforos
		SET nome = ?, localizacao = ?, turma = ?, equipe = ?, tempo_vermelho = ?, tempo_amarelo = ?, tempo_verde = ?
		WHERE id = ?
	`),
	atualizarTempos: banco.prepare('UPDATE semaforos SET tempo_vermelho = ?, tempo_amarelo = ?, tempo_verde = ? WHERE id = ?'),
	excluir: banco.prepare('DELETE FROM semaforos WHERE id = ?'),
	contar: banco.prepare('SELECT COUNT(*) AS total FROM semaforos'),
	statusAoVivo: banco.prepare(`
		SELECT s.id, s.nome, e.estado, e.recebido_em AS recebidoEm,
			strftime('%s', 'now', 'localtime') - strftime('%s', e.recebido_em) AS segundosAtras
		FROM semaforos s
		LEFT JOIN estados e ON e.id = (SELECT MAX(id) FROM estados WHERE id_dispositivo = s.id)
		ORDER BY s.id
	`),
};

const paraJson = (linha) => linha && ({
	id: linha.id,
	nome: linha.nome,
	localizacao: linha.localizacao,
	turma: linha.turma,
	equipe: linha.equipe,
	tempoVermelho: linha.tempo_vermelho,
	tempoAmarelo: linha.tempo_amarelo,
	tempoVerde: linha.tempo_verde,
});

const textoOpcional = (valor) => (typeof valor === 'string' ? valor.trim() : '');

const tempoEhValido = (segundos) =>
	typeof segundos === 'number' && Number.isFinite(segundos) &&
	segundos >= TEMPO_MINIMO && segundos <= TEMPO_MAXIMO;

// RN05 — devolve a mensagem de erro, ou null quando os três tempos são válidos
function validarTempos(vermelho, amarelo, verde) {
	const intervalo = `entre ${TEMPO_MINIMO} e ${TEMPO_MAXIMO} segundos`;
	if (!tempoEhValido(vermelho)) return `Tempo Vermelho deve ser ${intervalo}.`;
	if (!tempoEhValido(amarelo)) return `Tempo Amarelo deve ser ${intervalo}.`;
	if (!tempoEhValido(verde)) return `Tempo Verde deve ser ${intervalo}.`;
	return null;
}

// O id vira parte do tópico MQTT, onde '/', '+' e '#' têm significado especial
function validarId(id) {
	if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,30}$/.test(id)) {
		return 'O ID deve ter até 30 caracteres: letras, números, "-" ou "_".';
	}
	return null;
}

function validarDados({ nome, localizacao, turma, equipe, tempoVermelho, tempoAmarelo, tempoVerde }) {
	if (typeof nome !== 'string' || !nome.trim() || nome.trim().length > 60) return 'O nome é obrigatório (até 60 caracteres).';
	if (textoOpcional(localizacao).length > 80) return 'A localização deve ter até 80 caracteres.';
	if (textoOpcional(turma).length > 30) return 'A turma deve ter até 30 caracteres.';
	if (textoOpcional(equipe).length > 30) return 'A equipe deve ter até 30 caracteres.';
	return validarTempos(tempoVermelho, tempoAmarelo, tempoVerde);
}

function buscar(id) {
	return paraJson(consultas.buscar.get(id));
}

function criar(id, dados) {
	consultas.inserir.run(id, dados.nome.trim(), textoOpcional(dados.localizacao), textoOpcional(dados.turma),
		textoOpcional(dados.equipe), dados.tempoVermelho, dados.tempoAmarelo, dados.tempoVerde);
	return buscar(id);
}

function atualizar(id, dados) {
	consultas.atualizar.run(dados.nome.trim(), textoOpcional(dados.localizacao), textoOpcional(dados.turma),
		textoOpcional(dados.equipe), dados.tempoVermelho, dados.tempoAmarelo, dados.tempoVerde, id);
	return buscar(id);
}

module.exports = {
	validarId,
	validarDados,
	validarTempos,
	criar,
	atualizar,
	buscar,
	listar: () => consultas.listar.all().map(paraJson),
	atualizarTempos: (id, vermelho, amarelo, verde) => consultas.atualizarTempos.run(vermelho, amarelo, verde, id),
	excluir: (id) => consultas.excluir.run(id),
	contar: () => consultas.contar.get().total,
	statusAoVivo: () => consultas.statusAoVivo.all(),
};
