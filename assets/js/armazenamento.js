'use strict';

// Fala com a API do back-end. Os dados do sistema ficam no banco SQLite.
const Armazenamento = (() => {
	const PORTA_DA_API = '3000';
	const CHAVE_SESSAO = 'sessao';

	// Na porta da API o caminho é relativo; no Live Server (outra porta) precisa do endereço completo
	const URL_DA_API = location.port === PORTA_DA_API ? '' : `http://localhost:${PORTA_DA_API}`;

	function _lerToken() {
		try { return (JSON.parse(sessionStorage.getItem(CHAVE_SESSAO) || 'null') || {}).token; } catch { return null; }
	}

	// Faz a chamada e devolve o JSON da resposta; qualquer erro vira Error com
	// uma mensagem pronta pra mostrar na tela
	async function _requisitar(metodo, caminho, corpo) {
		const token = _lerToken();
		const cabecalhos = {};
		if (corpo !== undefined) cabecalhos['Content-Type'] = 'application/json';
		if (token) cabecalhos.Authorization = `Bearer ${token}`;

		let resposta;
		try {
			resposta = await fetch(URL_DA_API + caminho, {
				method: metodo,
				headers: cabecalhos,
				body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
			});
		} catch {
			throw new Error('Não foi possível conectar ao servidor. Verifique se o back-end está rodando.');
		}

		// Sessão vencida ou encerrada no servidor: volta pro login
		if (resposta.status === 401 && token) {
			sessionStorage.removeItem(CHAVE_SESSAO);
			location.replace('login.html');
		}

		const dados = await resposta.json().catch(() => null);
		if (!resposta.ok) throw new Error((dados && dados.erro) || 'Erro ao falar com o servidor.');
		return dados;
	}

	return {
		// ── Sessão ──
		entrar(email, senha) {
			return _requisitar('POST', '/login', { email, senha });
		},

		sair() {
			return _requisitar('POST', '/logout');
		},

		// ── Painel ──
		obterPainel() {
			return _requisitar('GET', '/painel');
		},

		// ── CRUD de Usuários ──
		listarUsuarios() {
			return _requisitar('GET', '/usuarios');
		},

		// Com id atualiza; sem id cria um novo
		salvarUsuario(usuario) {
			return usuario.id
				? _requisitar('PUT', `/usuarios/${encodeURIComponent(usuario.id)}`, usuario)
				: _requisitar('POST', '/usuarios', usuario);
		},

		excluirUsuario(id) {
			return _requisitar('DELETE', `/usuarios/${encodeURIComponent(id)}`);
		},

		// ── CRUD de Semáforos ──
		listarDispositivos() {
			return _requisitar('GET', '/semaforos');
		},

		// O id é escolhido no cadastro, então é quem chama que diz se o semáforo é novo
		salvarDispositivo(dispositivo, ehNovo) {
			return ehNovo
				? _requisitar('POST', '/semaforos', dispositivo)
				: _requisitar('PUT', `/semaforos/${encodeURIComponent(dispositivo.id)}`, dispositivo);
		},

		excluirDispositivo(id) {
			return _requisitar('DELETE', `/semaforos/${encodeURIComponent(id)}`);
		},
	};
})();

window.Armazenamento = Armazenamento;
