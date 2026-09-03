'use strict';

/*
 * Visualização de logs de comandos - lê histórico do sessionStorage e exibe em tabela filtrável
 */
(function () {
	// Escapa HTML pra segurança
	function escape(s) {
		return String(s).replace(/[&<>"']/g, (c) => ({
			'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
		})[c]);
	}

	// Adiciona classe CSS baseado no resultado do comando
	function rowClass(result) {
		if (result === 'OK') return 'log-result-ok';
		if (result === 'REJECTED') return 'log-result-rejected';
		return 'log-result-safe';
	}

	// Carrega logs do sessionStorage (salvos pelo app.js)
	function load() {
		try {
			const raw = sessionStorage.getItem('commandLog');
			return raw ? JSON.parse(raw) : [];
		} catch (e) {
			return [];
		}
	}

	// Renderiza logs na tabela
	function render(entries) {
		const tbody = document.getElementById('log-tbody');
		const empty = document.getElementById('log-empty');
		const table = document.getElementById('log-table');
		if (!tbody) return;

		if (!entries.length) {
			if (empty) empty.style.display = '';
			if (table) table.style.display = 'none';
			tbody.innerHTML = '';
			return;
		}

		if (empty) empty.style.display = 'none';
		if (table) table.style.display = '';

		tbody.innerHTML = entries.map((e) => {
			const ts = new Date(e.timestamp).toLocaleString('pt-BR');
			return `<tr>
				<td>${escape(ts)}</td>
				<td><code>${escape(e.deviceId)}</code></td>
				<td>${escape(e.origin)}</td>
				<td>${escape(e.command)}</td>
				<td class="${rowClass(e.result)}">${escape(e.result)}</td>
				<td>${escape(e.reason)}</td>
			</tr>`;
		}).join('');
	}

	// Filtro de busca na tabela
	function wireFilter() {
		const input = document.getElementById('log-filter');
		if (!input) return;
		input.addEventListener('keyup', () => {
			const q = input.value.trim().toLowerCase();
			const rows = document.querySelectorAll('#log-tbody tr');
			rows.forEach((tr) => {
				const text = tr.textContent.toLowerCase();
				tr.style.display = q === '' || text.includes(q) ? '' : 'none';
			});
		});
	}

	document.addEventListener('DOMContentLoaded', () => {
		render(load());
		wireFilter();
	});
})();
