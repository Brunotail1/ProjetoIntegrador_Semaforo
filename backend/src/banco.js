'use strict';

const { DatabaseSync } = require('node:sqlite'); // SQLite já vem embutido no Node
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { CAMINHO_BANCO } = require('./config');
const { gerarHashDeSenha } = require('./senhas');

fs.mkdirSync(path.dirname(CAMINHO_BANCO), { recursive: true });

// timeout: espera até 5s se o banco estiver ocupado (ex.: aberto no sqlite3 ao mesmo tempo)
const banco = new DatabaseSync(CAMINHO_BANCO, { timeout: 5000 });
banco.exec('PRAGMA foreign_keys = ON');

banco.exec(`
	CREATE TABLE IF NOT EXISTS usuarios (
		id         TEXT PRIMARY KEY,
		nome       TEXT NOT NULL,
		email      TEXT NOT NULL UNIQUE COLLATE NOCASE,
		senha_hash TEXT NOT NULL,
		role       TEXT NOT NULL CHECK (role IN ('admin', 'operador')),
		criado_em  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
	);
	CREATE TABLE IF NOT EXISTS sessoes (
		token_hash TEXT PRIMARY KEY,
		usuario_id TEXT NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
		expira_em  INTEGER NOT NULL
	);
	CREATE TABLE IF NOT EXISTS semaforos (
		id             TEXT PRIMARY KEY,
		nome           TEXT NOT NULL,
		localizacao    TEXT NOT NULL DEFAULT '',
		turma          TEXT NOT NULL DEFAULT '',
		equipe         TEXT NOT NULL DEFAULT '',
		tempo_vermelho REAL NOT NULL,
		tempo_amarelo  REAL NOT NULL,
		tempo_verde    REAL NOT NULL,
		criado_em      TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
	);
	CREATE TABLE IF NOT EXISTS estados (
		id             INTEGER PRIMARY KEY AUTOINCREMENT,
		id_dispositivo TEXT NOT NULL,
		estado         TEXT,
		payload        TEXT NOT NULL,
		recebido_em    TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
	);
	CREATE TABLE IF NOT EXISTS falhas (
		id             INTEGER PRIMARY KEY AUTOINCREMENT,
		id_dispositivo TEXT NOT NULL,
		luz            TEXT,
		payload        TEXT NOT NULL,
		recebido_em    TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
	);
	-- RN07: histórico de comandos. Guarda o e-mail, não uma chave estrangeira,
	-- pra o histórico continuar valendo depois que o usuário for excluído.
	CREATE TABLE IF NOT EXISTS comandos (
		id             INTEGER PRIMARY KEY AUTOINCREMENT,
		id_dispositivo TEXT NOT NULL,
		origem         TEXT NOT NULL,
		comando        TEXT NOT NULL,
		resultado      TEXT NOT NULL DEFAULT 'OK',
		motivo         TEXT NOT NULL DEFAULT '',
		usuario        TEXT,
		criado_em      TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
	);
	CREATE INDEX IF NOT EXISTS idx_estados_dispositivo  ON estados (id_dispositivo, id);
	CREATE INDEX IF NOT EXISTS idx_falhas_dispositivo   ON falhas (id_dispositivo, id);
	CREATE INDEX IF NOT EXISTS idx_comandos_dispositivo ON comandos (id_dispositivo, id);
`);

// Dados iniciais entram uma vez só: quem excluir os semáforos padrão não os vê
// voltar no próximo start. O user_version do SQLite guarda que isso já rodou.
function inserirDadosIniciais() {
	const { user_version: versao } = banco.prepare('PRAGMA user_version').get();
	if (versao >= 1) return;

	banco.prepare('INSERT INTO usuarios (id, nome, email, senha_hash, role) VALUES (?, ?, ?, ?, ?)')
		.run(crypto.randomUUID(), 'Administrador', 'admin@sistema.local', gerarHashDeSenha('123456'), 'admin');

	const inserirSemaforo = banco.prepare(`
		INSERT INTO semaforos (id, nome, tempo_vermelho, tempo_amarelo, tempo_verde) VALUES (?, ?, 5, 3, 5)
	`);
	inserirSemaforo.run('sem-a', 'Semáforo A');
	inserirSemaforo.run('sem-b', 'Semáforo B');

	banco.exec('PRAGMA user_version = 1');
}

inserirDadosIniciais();

module.exports = banco;
