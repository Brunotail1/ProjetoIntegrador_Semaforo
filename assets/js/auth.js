'use strict';

const Auth = (() => {
	const KEY = 'session';

	function getSession() {
		try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { return null; }
	}

	function isAdmin() {
		const s = getSession();
		return !!(s && s.role === 'admin');
	}

	function logout() {
		sessionStorage.removeItem(KEY);
		location.replace('login.html');
	}

	function guard() {
		if (!getSession()) location.replace('login.html');
	}

	function guardAdmin() {
		if (!getSession()) { location.replace('login.html'); return; }
		if (!isAdmin()) location.replace('index.html');
	}

	function _esc(s) {
		return String(s || '').replace(/[&<>"']/g, c =>
			({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
	}

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

// Auto-guard and inject nav. Scripts load after DOM (bottom of body), so DOM is ready.
Auth.guard();
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', () => Auth.injectNav());
} else {
	Auth.injectNav();
}
