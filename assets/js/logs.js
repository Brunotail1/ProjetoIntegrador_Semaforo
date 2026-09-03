'use strict';

/*
 * logs.js — Full command-log viewer for logs.html.
 * Reads the persisted log from sessionStorage['commandLog'] (written by app.js
 * on the dashboard) and renders it into a filterable table.
 */
(function () {
	function escape(s) {
		return String(s).replace(/[&<>"']/g, (c) => ({
			'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
		})[c]);
	}

	function rowClass(result) {
		if (result === 'OK') return 'log-result-ok';
		if (result === 'REJECTED') return 'log-result-rejected';
		return 'log-result-safe';
	}

	function load() {
		try {
			const raw = sessionStorage.getItem('commandLog');
			return raw ? JSON.parse(raw) : [];
		} catch (e) {
			return [];
		}
	}

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
