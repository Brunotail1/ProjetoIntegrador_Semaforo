'use strict';

// Gerencia sessão e permissões do usuário logado
const Auth = (() => {
	const KEY = 'session';

	// Pega dados do usuário logado (fica no sessionStorage)
	function getSession() {
		try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { return null; }
	}

	// Verifica se usuário logado é admin
	function isAdmin() {
		const s = getSession();
		return !!(s && s.role === 'admin');
	}

	// Desloga e volta pro login
	function logout() {
		sessionStorage.removeItem(KEY);
		location.replace('login.html');
	}

	// Protege páginas - redireciona se não tiver logado
	function guard() {
		if (!getSession()) location.replace('login.html');
	}

	// Protege páginas admin - redireciona se não for admin
	function guardAdmin() {
		if (!getSession()) { location.replace('login.html'); return; }
		if (!isAdmin()) location.replace('index.html');
	}

	// Escapa caracteres HTML pra evitar XSS
	function _esc(s) {
		return String(s || '').replace(/[&<>"']/g, c =>
			({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
	}

	// Adiciona nome do usuário e botão "Sair" no menu
	function injectNav() {
		const s = getSession();
		if (!s) return;
		const ul = document.querySelector('#header nav ul');
		if (!ul) return;
		const li = document.createElement('li');
		li.innerHTML = `<a href="#" id="nav-logout" title="Sair do sistema">${_esc(s.nome)}&nbsp;<span style="opacity:0.5;">· Sair</span></a>`;
		ul.appendChild(li);
		document.getElementById('nav-logout').addEventListener('click', e => {
			e.preventDefault();
			logout();
		});
	}

	return { getSession, isAdmin, logout, guard, guardAdmin, injectNav };
})();

window.Auth = Auth;

// Executa guard e injeta menu automaticamente em todas as páginas
Auth.guard();
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', () => Auth.injectNav());
} else {
	Auth.injectNav();
}
