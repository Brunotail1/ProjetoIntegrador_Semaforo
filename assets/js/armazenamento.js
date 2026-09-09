'use strict';

// Gerencia os dados do sistema no localStorage do navegador
const Armazenamento = (() => {
	// Chaves onde os dados ficam salvos
	const CHAVE_USUARIOS     = 'semaforo_usuarios';
	const CHAVE_DISPOSITIVOS = 'semaforo_dispositivos';

	// Lê uma lista do localStorage e converte de JSON pra array
	function _lerLista(chave) {
		try { return JSON.parse(localStorage.getItem(chave) || '[]'); } catch { return []; }
	}

	// Salva uma lista no localStorage convertendo pra JSON
	function _gravarLista(chave, lista) {
		try { localStorage.setItem(chave, JSON.stringify(lista)); } catch {}
	}

	return {
		// ── CRUD de Usuários ──
		listarUsuarios() {
			return _lerLista(CHAVE_USUARIOS);
		},

		salvarUsuario(usuario) {
			const usuarios = _lerLista(CHAVE_USUARIOS);
			// Gera ID único se não existir (timestamp convertido pra base36)
			if (!usuario.id) usuario.id = Date.now().toString(36);
			const indice = usuarios.findIndex((u) => u.id === usuario.id);
			// Atualiza se existe, senão adiciona novo
			if (indice >= 0) usuarios[indice] = usuario; else usuarios.push(usuario);
			_gravarLista(CHAVE_USUARIOS, usuarios);
			return usuario;
		},

		excluirUsuario(id) {
			_gravarLista(CHAVE_USUARIOS, _lerLista(CHAVE_USUARIOS).filter((u) => u.id !== id));
		},

		// ── CRUD de Semáforos ──
		listarDispositivos() {
			return _lerLista(CHAVE_DISPOSITIVOS);
		},

		salvarDispositivo(dispositivo) {
			const dispositivos = _lerLista(CHAVE_DISPOSITIVOS);
			const indice = dispositivos.findIndex((d) => d.id === dispositivo.id);
			// Atualiza se já existe, senão adiciona
			if (indice >= 0) dispositivos[indice] = dispositivo; else dispositivos.push(dispositivo);
			_gravarLista(CHAVE_DISPOSITIVOS, dispositivos);
			return dispositivo;
		},

		excluirDispositivo(id) {
			_gravarLista(CHAVE_DISPOSITIVOS, _lerLista(CHAVE_DISPOSITIVOS).filter((d) => d.id !== id));
		},
	};
})();

window.Armazenamento = Armazenamento;
