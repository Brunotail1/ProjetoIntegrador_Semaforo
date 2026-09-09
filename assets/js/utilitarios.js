'use strict';

/*
 * utilitarios.js — funções auxiliares compartilhadas por todas as páginas.
 */

// Escapa caracteres especiais do HTML para evitar XSS ao montar tabelas e
// cards com template string.
function escaparHtml(texto) {
	return String(texto || '').replace(/[&<>"']/g, (caractere) =>
		({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[caractere]);
}

window.escaparHtml = escaparHtml;
