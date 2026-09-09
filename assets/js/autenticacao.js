'use strict';

// Gerencia a sessão e as permissões do usuário logado
const Autenticacao = (() => {
	const CHAVE_SESSAO = 'sessao';

	// Devolve os dados do usuário logado (ficam no sessionStorage)
	function obterSessao() {
		try { return JSON.parse(sessionStorage.getItem(CHAVE_SESSAO) || 'null'); } catch { return null; }
	}

	// Informa se o usuário logado tem perfil de administrador
	function ehAdministrador() {
		const sessao = obterSessao();
		return !!(sessao && sessao.role === 'admin');
	}

	// Encerra a sessão e volta pra tela de login
	function sair() {
		sessionStorage.removeItem(CHAVE_SESSAO);
		location.replace('login.html');
	}

	// Protege páginas internas — manda pro login quem não estiver logado
	function exigirLogin() {
		if (!obterSessao()) location.replace('login.html');
	}

	// Protege páginas de administrador — manda operadores de volta pro painel
	function exigirAdministrador() {
		if (!obterSessao()) { location.replace('login.html'); return; }
		if (!ehAdministrador()) location.replace('index.html');
	}

	// Acrescenta o nome do usuário e o botão "Sair" no menu do topo
	function adicionarUsuarioNoMenu() {
		const sessao = obterSessao();
		if (!sessao) return;
		const menu = document.querySelector('#header nav ul');
		if (!menu) return;
		const item = document.createElement('li');
		item.innerHTML = `<a href="#" id="nav-logout" title="Sair do sistema">${escaparHtml(sessao.nome)}&nbsp;<span style="opacity:0.5;">· Sair</span></a>`;
		menu.appendChild(item);
		document.getElementById('nav-logout').addEventListener('click', (evento) => {
			evento.preventDefault();
			sair();
		});
	}

	return { obterSessao, ehAdministrador, sair, exigirLogin, exigirAdministrador, adicionarUsuarioNoMenu };
})();

window.Autenticacao = Autenticacao;

// Protege a página e monta o menu automaticamente assim que o script carrega
Autenticacao.exigirLogin();
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', () => Autenticacao.adicionarUsuarioNoMenu());
} else {
	Autenticacao.adicionarUsuarioNoMenu();
}
