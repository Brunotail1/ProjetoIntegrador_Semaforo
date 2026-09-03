'use strict';

// Gerencia dados no localStorage do navegador
const Storage = (() => {
	// Chaves onde os dados ficam salvos
	const USERS_KEY   = 'semaforo_usuarios';
	const DEVICES_KEY = 'semaforo_dispositivos';

	// Lê dados do localStorage e converte de JSON pra objeto
	function _read(key) {
		try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
	}

	// Salva dados no localStorage convertendo objeto pra JSON
	function _write(key, arr) {
		try { localStorage.setItem(key, JSON.stringify(arr)); } catch {}
	}

	return {
		// ── CRUD de Usuários ──
		getUsers() {
			return _read(USERS_KEY);
		},

		saveUser(user) {
			const users = _read(USERS_KEY);
			// Gera ID único se não existir (timestamp convertido pra base36)
			if (!user.id) user.id = Date.now().toString(36);
			const idx = users.findIndex(u => u.id === user.id);
			// Atualiza se existe, senão adiciona novo
			if (idx >= 0) users[idx] = user; else users.push(user);
			_write(USERS_KEY, users);
			return user;
		},

		deleteUser(id) {
			_write(USERS_KEY, _read(USERS_KEY).filter(u => u.id !== id));
		},

		// ── CRUD de Semáforos ──
		getDevices() {
			return _read(DEVICES_KEY);
		},

		saveDevice(device) {
			const devices = _read(DEVICES_KEY);
			const idx = devices.findIndex(d => d.id === device.id);
			// Atualiza se já existe, senão adiciona
			if (idx >= 0) devices[idx] = device; else devices.push(device);
			_write(DEVICES_KEY, devices);
			return device;
		},

		deleteDevice(id) {
			_write(DEVICES_KEY, _read(DEVICES_KEY).filter(d => d.id !== id));
		},

		// ── Layout do cruzamento (qual semáforo em qual posição) ──
		getDeviceLayout() {
			try {
				return JSON.parse(localStorage.getItem('semaforo_cruzamento') || 'null') ||
					{ norte: null, sul: null, leste: null, oeste: null };
			} catch { return { norte: null, sul: null, leste: null, oeste: null }; }
		},

		saveDeviceLayout(layout) {
			try { localStorage.setItem('semaforo_cruzamento', JSON.stringify(layout)); } catch {}
		},
	};
})();

window.Storage = Storage;
