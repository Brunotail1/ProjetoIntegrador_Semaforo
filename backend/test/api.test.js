'use strict';

process.env.BANCO_DB = ':memory:';

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');

const banco = require('../src/banco');
const { criarApp } = require('../src/app');
const { processarMensagem } = require('../src/mqtt');

const TOPICO = 'aps1/semaforo/TURMA/EQUIPE/sem-a';
const SEMAFORO_NOVO = { id: 'sem-teste', nome: 'Teste', tempoVermelho: 5, tempoAmarelo: 3, tempoVerde: 5 };

let servidor;
let urlBase;
let tokenAdmin;

async function chamar(metodo, caminho, { token, corpo, cabecalhos } = {}) {
	const resposta = await fetch(urlBase + caminho, {
		method: metodo,
		headers: {
			...(corpo !== undefined && { 'Content-Type': 'application/json' }),
			...(token && { Authorization: `Bearer ${token}` }),
			...cabecalhos,
		},
		body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
	});
	const texto = await resposta.text();
	let dados = null;
	try { dados = texto ? JSON.parse(texto) : null; } catch { dados = texto; }
	return { status: resposta.status, dados, cabecalhos: resposta.headers };
}

async function entrar(email, senha) {
	const { dados } = await chamar('POST', '/login', { corpo: { email, senha } });
	return dados.token;
}

async function criarOperador(email) {
	const { dados } = await chamar('POST', '/usuarios', {
		token: tokenAdmin,
		corpo: { nome: 'Operador', email, role: 'operador', senha: 'abcd' },
	});
	return { usuario: dados, token: await entrar(email, 'abcd') };
}

before(async () => {
	servidor = criarApp().listen(0);
	await new Promise((resolve) => servidor.once('listening', resolve));
	urlBase = `http://127.0.0.1:${servidor.address().port}`;
	tokenAdmin = await entrar('admin@sistema.local', '123456');
});

after(() => servidor.close());

test('login aceita o admin inicial e não devolve o hash da senha', async () => {
	const { status, dados } = await chamar('POST', '/login', {
		corpo: { email: 'ADMIN@sistema.local', senha: '123456' },
	});
	assert.equal(status, 200);
	assert.equal(dados.role, 'admin');
	assert.ok(dados.token);
	assert.equal(dados.senha_hash, undefined);
});

test('login recusa senha errada, e-mail desconhecido e corpo incompleto', async () => {
	const senhaErrada = await chamar('POST', '/login', { corpo: { email: 'admin@sistema.local', senha: 'x' } });
	const semCadastro = await chamar('POST', '/login', { corpo: { email: 'nao@existe.com', senha: 'x' } });
	const incompleto = await chamar('POST', '/login', { corpo: { email: 'admin@sistema.local' } });
	assert.equal(senhaErrada.status, 401);
	assert.equal(semCadastro.status, 401);
	assert.equal(incompleto.status, 400);
});

test('rotas protegidas exigem token válido', async () => {
	for (const caminho of ['/sessao', '/usuarios', '/semaforos', '/painel', '/comandos', '/semaforos/sem-a/status']) {
		assert.equal((await chamar('GET', caminho)).status, 401, caminho);
		assert.equal((await chamar('GET', caminho, { token: 'invalido' })).status, 401, caminho);
	}
});

test('logout invalida o token', async () => {
	const token = await entrar('admin@sistema.local', '123456');
	assert.equal((await chamar('GET', '/sessao', { token })).status, 200);
	assert.equal((await chamar('POST', '/logout', { token })).status, 204);
	assert.equal((await chamar('GET', '/sessao', { token })).status, 401);
});

test('senha e token ficam só como hash no banco', async () => {
	const { senha_hash: senhaHash } = banco.prepare("SELECT senha_hash FROM usuarios WHERE email = 'admin@sistema.local'").get();
	assert.match(senhaHash, /^scrypt\$/);
	assert.ok(!senhaHash.includes('123456'));

	const sessoes = banco.prepare('SELECT token_hash FROM sessoes').all().map((s) => s.token_hash);
	assert.ok(!sessoes.includes(tokenAdmin));
});

test('CRUD de usuários', async () => {
	const criado = await chamar('POST', '/usuarios', {
		token: tokenAdmin,
		corpo: { nome: ' Ana ', email: 'ana@teste.com', role: 'operador', senha: 'abcd' },
	});
	assert.equal(criado.status, 201);
	assert.equal(criado.dados.nome, 'Ana');
	assert.equal(criado.dados.senha_hash, undefined);

	const duplicado = await chamar('POST', '/usuarios', {
		token: tokenAdmin,
		corpo: { nome: 'Outra', email: 'ANA@teste.com', role: 'operador', senha: 'abcd' },
	});
	assert.equal(duplicado.status, 409);

	const lista = await chamar('GET', '/usuarios', { token: tokenAdmin });
	assert.ok(lista.dados.some((u) => u.email === 'ana@teste.com'));
	assert.ok(lista.dados.every((u) => u.senha_hash === undefined));

	const caminho = `/usuarios/${criado.dados.id}`;
	const editado = await chamar('PUT', caminho, {
		token: tokenAdmin,
		corpo: { nome: 'Ana Maria', email: 'ana@teste.com', role: 'operador' },
	});
	assert.equal(editado.dados.nome, 'Ana Maria');
	assert.ok(await entrar('ana@teste.com', 'abcd'), 'senha em branco mantém a atual');

	assert.equal((await chamar('DELETE', caminho, { token: tokenAdmin })).status, 204);
	assert.equal((await chamar('DELETE', caminho, { token: tokenAdmin })).status, 404);
});

test('usuários: validação de campos', async () => {
	const invalidos = [
		{ nome: '', email: 'a@b.com', role: 'operador', senha: 'abcd' },
		{ nome: 'A', email: 'sem-arroba', role: 'operador', senha: 'abcd' },
		{ nome: 'A', email: 'a@b.com', role: 'root', senha: 'abcd' },
		{ nome: 'A', email: 'a@b.com', role: 'operador', senha: 'abc' },
		{ nome: 'A', email: 'a@b.com', role: 'operador' },
		{ nome: 'A', email: 'a@b.com', role: 'operador', senha: 1234 },
	];
	for (const corpo of invalidos) {
		assert.equal((await chamar('POST', '/usuarios', { token: tokenAdmin, corpo })).status, 400, JSON.stringify(corpo));
	}
});

test('trocar a senha derruba as sessões abertas do usuário', async () => {
	const { usuario, token } = await criarOperador('troca@teste.com');
	await chamar('PUT', `/usuarios/${usuario.id}`, {
		token: tokenAdmin,
		corpo: { nome: usuario.nome, email: usuario.email, role: usuario.role, senha: 'nova-senha' },
	});
	assert.equal((await chamar('GET', '/sessao', { token })).status, 401);
	assert.ok(await entrar('troca@teste.com', 'nova-senha'));
});

test('admin não exclui a si mesmo nem rebaixa o último administrador', async () => {
	const { dados: sessao } = await chamar('GET', '/sessao', { token: tokenAdmin });
	const exclusao = await chamar('DELETE', `/usuarios/${sessao.id}`, { token: tokenAdmin });
	assert.equal(exclusao.status, 409);

	const rebaixamento = await chamar('PUT', `/usuarios/${sessao.id}`, {
		token: tokenAdmin,
		corpo: { nome: sessao.nome, email: sessao.email, role: 'operador' },
	});
	assert.equal(rebaixamento.status, 409);
});

test('operador consulta, mas não altera cadastros', async () => {
	const { token } = await criarOperador('consulta@teste.com');

	assert.equal((await chamar('GET', '/semaforos', { token })).status, 200);
	assert.equal((await chamar('GET', '/painel', { token })).status, 200);
	assert.equal((await chamar('GET', '/usuarios', { token })).status, 403);
	assert.equal((await chamar('POST', '/semaforos', { token, corpo: SEMAFORO_NOVO })).status, 403);
	assert.equal((await chamar('DELETE', '/semaforos/sem-a', { token })).status, 403);
	assert.equal((await chamar('POST', '/semaforos/sem-a/configuracao', {
		token, corpo: { vermelho: 5, amarelo: 3, verde: 5 },
	})).status, 403);
});

test('CRUD de semáforos', async () => {
	const padrao = await chamar('GET', '/semaforos', { token: tokenAdmin });
	assert.deepEqual(padrao.dados.map((s) => s.id).slice(0, 2), ['sem-a', 'sem-b']);

	const criado = await chamar('POST', '/semaforos', { token: tokenAdmin, corpo: SEMAFORO_NOVO });
	assert.equal(criado.status, 201);
	assert.equal((await chamar('POST', '/semaforos', { token: tokenAdmin, corpo: SEMAFORO_NOVO })).status, 409);

	const editado = await chamar('PUT', '/semaforos/sem-teste', {
		token: tokenAdmin,
		corpo: { ...SEMAFORO_NOVO, nome: 'Novo nome', localizacao: 'Av. Principal', tempoVerde: 20 },
	});
	assert.equal(editado.dados.nome, 'Novo nome');
	assert.equal(editado.dados.localizacao, 'Av. Principal');
	assert.equal(editado.dados.tempoVerde, 20);

	assert.equal((await chamar('DELETE', '/semaforos/sem-teste', { token: tokenAdmin })).status, 204);
	assert.equal((await chamar('GET', '/semaforos/sem-teste', { token: tokenAdmin })).status, 404);
});

test('semáforos: RN05 e id seguro para o tópico MQTT', async () => {
	const invalidos = [
		{ ...SEMAFORO_NOVO, id: 'a/b' },
		{ ...SEMAFORO_NOVO, id: 'sem+a' },
		{ ...SEMAFORO_NOVO, id: 'sem#' },
		{ ...SEMAFORO_NOVO, id: '' },
		{ ...SEMAFORO_NOVO, nome: '' },
		{ ...SEMAFORO_NOVO, tempoVermelho: 0 },
		{ ...SEMAFORO_NOVO, tempoAmarelo: 61 },
		{ ...SEMAFORO_NOVO, tempoVerde: '5' },
	];
	for (const corpo of invalidos) {
		assert.equal((await chamar('POST', '/semaforos', { token: tokenAdmin, corpo })).status, 400, JSON.stringify(corpo));
	}
});

test('configuração valida os tempos, salva no cadastro e entra no histórico', async () => {
	const invalida = await chamar('POST', '/semaforos/sem-b/configuracao', {
		token: tokenAdmin, corpo: { vermelho: 100, amarelo: 3, verde: 5 },
	});
	assert.equal(invalida.status, 400);

	assert.equal((await chamar('POST', '/semaforos/nao-existe/configuracao', {
		token: tokenAdmin, corpo: { vermelho: 5, amarelo: 3, verde: 5 },
	})).status, 404);

	// Sem broker nos testes: fica salvo e avisa que não foi enviado
	const valida = await chamar('POST', '/semaforos/sem-b/configuracao', {
		token: tokenAdmin, corpo: { vermelho: 10, amarelo: 4, verde: 8 },
	});
	assert.equal(valida.status, 202);
	assert.equal(valida.dados.enviado, false);

	const { dados: semaforo } = await chamar('GET', '/semaforos/sem-b', { token: tokenAdmin });
	assert.deepEqual([semaforo.tempoVermelho, semaforo.tempoAmarelo, semaforo.tempoVerde], [10, 4, 8]);

	const { dados: historico } = await chamar('GET', '/comandos?dispositivo=sem-b&limite=1', { token: tokenAdmin });
	assert.equal(historico[0].comando, 'configurar');
	assert.equal(historico[0].resultado, 'NAO_ENVIADO');
	assert.equal(historico[0].usuario, 'admin@sistema.local');
});

test('comando valida o valor e responde 503 sem broker', async () => {
	const { token } = await criarOperador('comando@teste.com');
	const invalido = await chamar('POST', '/semaforos/sem-a/comando', { token, corpo: { cmd: 'roxo' } });
	assert.equal(invalido.status, 400);

	const semBroker = await chamar('POST', '/semaforos/sem-a/comando', { token, corpo: { cmd: 'verde' } });
	assert.equal(semBroker.status, 503);
});

test('estado e falha recebidos por MQTT aparecem no status e no painel', async () => {
	processarMensagem(`${TOPICO}/estado`, Buffer.from('{"estado":"RED"}'));
	processarMensagem(`${TOPICO}/estado`, Buffer.from('{"estado":"GREEN"}'));
	processarMensagem(`${TOPICO}/falha`, Buffer.from('{"luz":"vermelho"}'));

	const { dados: status } = await chamar('GET', '/semaforos/sem-a/status', { token: tokenAdmin });
	assert.equal(status.situacao.estado, 'GREEN');
	assert.ok(status.situacao.recebidoEm);
	assert.equal(status.falhas[0].luz, 'vermelho');

	const { dados: painel } = await chamar('GET', '/painel', { token: tokenAdmin });
	const semA = painel.statusAoVivo.find((s) => s.id === 'sem-a');
	assert.equal(semA.estado, 'GREEN');
	assert.ok(semA.segundosAtras >= 0 && semA.segundosAtras < 5);
	assert.ok(painel.totalSemaforos >= 2);
	assert.ok(painel.totalUsuarios >= 1);
});

test('configuração recebida por MQTT é limitada pela RN05 e mantém o que não veio', async () => {
	processarMensagem(`${TOPICO}/configuracao`, Buffer.from('{"vermelho":500,"amarelo":0}'));
	const { dados } = await chamar('GET', '/semaforos/sem-a', { token: tokenAdmin });
	assert.deepEqual([dados.tempoVermelho, dados.tempoAmarelo, dados.tempoVerde], [60, 1, 5]);
});

test('comando por MQTT entra no histórico, inclusive em texto puro', async () => {
	processarMensagem(`${TOPICO}/comando`, Buffer.from('{"cmd":"amarelo"}'));
	processarMensagem(`${TOPICO}/comando`, Buffer.from('verde'));
	const { dados } = await chamar('GET', '/comandos?dispositivo=sem-a&limite=2', { token: tokenAdmin });
	assert.deepEqual(dados.map((c) => c.comando), ['cmd:verde', 'cmd:amarelo']);
	assert.equal(dados[0].origem, 'MQTT');
});

test('mensagens inválidas e o eco do próprio back-end são ignorados', async () => {
	const contar = (tabela) => banco.prepare(`SELECT COUNT(*) AS total FROM ${tabela}`).get().total;
	const estados = contar('estados');
	const comandos = contar('comandos');

	processarMensagem(`${TOPICO}/estado`, Buffer.from('nao e json'));
	processarMensagem(`${TOPICO}/estado`, Buffer.from('null'));
	processarMensagem(`${TOPICO}/comando`, Buffer.from(''));
	processarMensagem(`${TOPICO}/comando`, Buffer.from('{"cmd":"verde","origem":"backend"}'));
	processarMensagem(`${TOPICO}/configuracao`, Buffer.from('{"vermelho":9,"origem":"backend"}'));

	assert.equal(contar('estados'), estados);
	assert.equal(contar('comandos'), comandos);
});

test('CORS libera só origens locais', async () => {
	const local = await chamar('GET', '/semaforos', {
		token: tokenAdmin, cabecalhos: { Origin: 'http://127.0.0.1:5500' },
	});
	assert.equal(local.cabecalhos.get('access-control-allow-origin'), 'http://127.0.0.1:5500');

	const externa = await chamar('GET', '/semaforos', {
		token: tokenAdmin, cabecalhos: { Origin: 'https://exemplo.com' },
	});
	assert.equal(externa.cabecalhos.get('access-control-allow-origin'), null);
});

test('serve as páginas, mas não os arquivos internos do projeto', async () => {
	assert.equal((await chamar('GET', '/')).status, 200);
	assert.equal((await chamar('GET', '/login.html')).status, 200);
	assert.equal((await chamar('GET', '/assets/js/simulador.js')).status, 200);
	assert.equal((await chamar('GET', '/console/')).status, 200);

	for (const caminho of ['/backend/server.js', '/.git/config', '/assets/../backend/package.json', '/console/../server.js']) {
		assert.equal((await chamar('GET', caminho)).status, 404, caminho);
	}
});

test('JSON malformado responde 400', async () => {
	const resposta = await fetch(`${urlBase}/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: '{invalido',
	});
	assert.equal(resposta.status, 400);
});
