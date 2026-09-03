'use strict';

const Storage = (() => {
	const USERS_KEY   = 'semaforo_usuarios';
	const DEVICES_KEY = 'semaforo_dispositivos';

	function _read(key) {
		try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
	}

	function _write(key, arr) {
		try { localStorage.setItem(key, JSON.stringify(arr)); } catch {}
	}

	return {
		// ── Users ─────────────────────────────────────────────────────────────
		getUsers() {
			return _read(USERS_KEY);
		},

		saveUser(user) {
			const users = _read(USERS_KEY);
			if (!user.id) user.id = Date.now().toString(36);
			const idx = users.findIndex(u => u.id === user.id);
			if (idx >= 0) users[idx] = user; else users.push(user);
			_write(USERS_KEY, users);
			return user;
		},

		deleteUser(id) {
			_write(USERS_KEY, _read(USERS_KEY).filter(u => u.id !== id));
		},

		// ── Devices ───────────────────────────────────────────────────────────
		getDevices() {
			return _read(DEVICES_KEY);
		},

		saveDevice(device) {
			const devices = _read(DEVICES_KEY);
			const idx = devices.findIndex(d => d.id === device.id);
			if (idx >= 0) devices[idx] = device; else devices.push(device);
			_write(DEVICES_KEY, devices);
			return device;
		},

		deleteDevice(id) {
			_write(DEVICES_KEY, _read(DEVICES_KEY).filter(d => d.id !== id));
		},

		// ── Crossing layout ───────────────────────────────────────────────────
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
