'use strict';

/*
 * app.js — Boot, crossing coordination, DOM binding and the command log for the
 * Smart Traffic Light dashboard (APS1 - Programação III).
 *
 * Business rules enforced here:
 *   RN01 — the two semaphores are never GREEN at the same time.
 *   RN02 — GREEN → RED always passes through YELLOW (in simulator.js).
 *   RN03 — a safety interval separates one semaphore's RED from the partner's GREEN.
 *   RN04 — loss of heartbeat / MQTT connection drops devices to the fail-safe state.
 *   RN05 — timing reconfiguration is clamped to [min, max] (in simulator.js).
 *   RN06 — the dashboard runs local-first: simulators start before MQTT connects.
 *   RN07 — every real transition is written to the command log.
 *   RN09 — a reported light failure forces the fail-safe (blinking yellow) state.
 *   RN10 — commands that would violate RN01 are rejected.
 */

// ── Crossing interactive ──────────────────────────────────────────────────────
const _crossingLayout = { norte: null, sul: null, leste: null, oeste: null };
const _slotCallbacks  = {}; // position → fn(state)

function _xEsc(s) {
	return String(s || '').replace(/[&<>"']/g, c =>
		({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function _renderCrossingDeviceList() {
	const list = document.getElementById('crossing-device-list');
	if (!list) return;
	list.querySelectorAll('.crossing-device-card').forEach(c => c.remove());
	const allocated = Object.values(_crossingLayout).filter(Boolean);
	CONFIG.deviceIds.forEach(id => {
		const d = (window.Storage ? Storage.getDevices() : []).find(x => x.id === id);
		const label = (d && d.nome) ? d.nome : (CONFIG.deviceLabels[id] || id);
		const card = document.createElement('div');
		card.className = 'crossing-device-card' + (allocated.includes(id) ? ' allocated' : '');
		card.draggable = true;
		card.dataset.deviceId = id;
		card.innerHTML = `<span class="device-id-tag">${_xEsc(id)}</span> ${_xEsc(label)} <span style="margin-left:auto;opacity:0.35;">⠿</span>`;
		card.addEventListener('dragstart', e => {
			e.dataTransfer.setData('text/plain', id);
			card.style.opacity = '0.4';
		});
		card.addEventListener('dragend', () => { card.style.opacity = ''; });
		list.appendChild(card);
	});
}

function _clearSlot(position) {
	const slot = document.querySelector(`.crossing-slot[data-position="${position}"]`);
	if (!slot) return;
	const cap = position.charAt(0).toUpperCase() + position.slice(1);
	slot.innerHTML = `<span class="slot-placeholder">${_xEsc(cap)}</span>`;
	slot.classList.remove('has-device', 'blink-yellow');
	slot.draggable = false;
	delete _slotCallbacks[position];
}

function _updateSlotVisual(slot, state) {
	if (!slot) return;
	slot.querySelectorAll('.twin-led').forEach(l => l.classList.remove('ligado'));
	slot.classList.remove('blink-yellow');
	slot.dataset.state = state;
	if (state === 'BLINK_YELLOW') {
		slot.classList.add('blink-yellow');
	} else {
		const map = { RED: 'twin-red', YELLOW: 'twin-yellow', GREEN: 'twin-green', SAFETY_RED: 'twin-red' };
		const led = slot.querySelector('.' + (map[state] || ''));
		if (led) led.classList.add('ligado');
	}
	const badge = slot.querySelector('.twin-state-badge');
	if (badge) badge.textContent = (STATE_LABEL && STATE_LABEL[state]) ? STATE_LABEL[state] : state;
}

function _renderSlot(position, deviceId) {
	const slot = document.querySelector(`.crossing-slot[data-position="${position}"]`);
	if (!slot) return;
	const d = (window.Storage ? Storage.getDevices() : []).find(x => x.id === deviceId);
	const label = (d && d.nome) ? d.nome : (CONFIG.deviceLabels[deviceId] || deviceId);
	const sem   = semaphores[deviceId];
	const state = sem ? sem.state : 'RED';
	const s     = deviceId.replace(/[^a-zA-Z0-9_-]/g, '_');
	const cap   = position.charAt(0).toUpperCase() + position.slice(1);

	slot.className = 'crossing-slot has-device';
	slot.draggable = true;
	slot.innerHTML = `
		<button class="slot-remove" title="Remover">×</button>
		<div class="slot-mini-twin">
			<svg class="semaforo-svg" viewBox="0 10 120 250" xmlns="http://www.w3.org/2000/svg">
				<defs>
					<radialGradient id="ms-${s}" cx="30%" cy="25%" r="50%">
						<stop offset="0%" stop-color="rgba(255,255,255,0.18)"/>
						<stop offset="100%" stop-color="rgba(255,255,255,0)"/>
					</radialGradient>
				</defs>
				<rect x="8" y="14" width="104" height="260" rx="14" fill="#2e2e2e" stroke="#0b0b0b" stroke-width="2"/>
				<circle cx="60" cy="71"  r="27" fill="#141010" class="twin-led twin-red"/>
				<circle cx="60" cy="150" r="27" fill="#131108" class="twin-led twin-yellow"/>
				<circle cx="60" cy="229" r="27" fill="#0d1309" class="twin-led twin-green"/>
				<circle cx="60" cy="71"  r="27" fill="url(#ms-${s})" pointer-events="none"/>
				<circle cx="60" cy="150" r="27" fill="url(#ms-${s})" pointer-events="none"/>
				<circle cx="60" cy="229" r="27" fill="url(#ms-${s})" pointer-events="none"/>
			</svg>
			<span class="twin-state-badge">—</span>
		</div>
		<div class="slot-label">${_xEsc(cap)} · ${_xEsc(deviceId)}</div>
	`;

	_updateSlotVisual(slot, state);
	_slotCallbacks[position] = (newState) => _updateSlotVisual(slot, newState);

	slot.querySelector('.slot-remove').addEventListener('click', () => {
		_crossingLayout[position] = null;
		_clearSlot(position);
		_renderCrossingDeviceList();
		if (window.Storage) Storage.saveDeviceLayout({ ..._crossingLayout });
	});
}

function assignToSlot(deviceId, position) {
	// Remove device from any other slot it may occupy
	Object.keys(_crossingLayout).forEach(pos => {
		if (_crossingLayout[pos] === deviceId && pos !== position) {
			_crossingLayout[pos] = null;
			_clearSlot(pos);
		}
	});
	_crossingLayout[position] = deviceId;
	_renderSlot(position, deviceId);
	_renderCrossingDeviceList();
	if (window.Storage) Storage.saveDeviceLayout({ ..._crossingLayout });
}

function initCrossing() {
	// Restore saved layout
	const saved = window.Storage ? Storage.getDeviceLayout() : {};
	Object.assign(_crossingLayout, saved);

	_renderCrossingDeviceList();

	// Wire drop zones
	document.querySelectorAll('.crossing-slot').forEach(slot => {
		slot.addEventListener('dragover', e => { e.preventDefault(); slot.classList.add('over'); });
		slot.addEventListener('dragleave', () => slot.classList.remove('over'));
		slot.addEventListener('drop', e => {
			e.preventDefault();
			slot.classList.remove('over');
			const id = e.dataTransfer.getData('text/plain');
			if (id) assignToSlot(id, slot.dataset.position);
		});
		// Arrastar A PARTIR de um slot ocupado
		slot.addEventListener('dragstart', e => {
			const deviceId = _crossingLayout[slot.dataset.position];
			if (!deviceId) { e.preventDefault(); return; }
			e.dataTransfer.setData('text/plain', deviceId);
			e.dataTransfer.effectAllowed = 'move';
			setTimeout(() => { slot.style.opacity = '0.45'; }, 0);
		});
		slot.addEventListener('dragend', () => { slot.style.opacity = ''; });
	});

	// Lista de dispositivos também aceita drop (retornar semáforo para a lista)
	const _devList = document.getElementById('crossing-device-list');
	if (_devList) {
		_devList.addEventListener('dragover', e => {
			e.preventDefault();
			_devList.style.outline = '1px dashed rgba(255,255,255,0.28)';
		});
		_devList.addEventListener('dragleave', () => { _devList.style.outline = ''; });
		_devList.addEventListener('drop', e => {
			e.preventDefault();
			_devList.style.outline = '';
			const id = e.dataTransfer.getData('text/plain');
			if (!id) return;
			Object.keys(_crossingLayout).forEach(pos => {
				if (_crossingLayout[pos] === id) {
					_crossingLayout[pos] = null;
					_clearSlot(pos);
				}
			});
			_renderCrossingDeviceList();
			if (window.Storage) Storage.saveDeviceLayout({ ..._crossingLayout });
		});
	}

	// Restore occupied slots
	Object.entries(_crossingLayout).forEach(([pos, id]) => {
		if (id) _renderSlot(pos, id);
	});
}

// ── Twin SVG builder ─────────────────────────────────────────────────────────
function buildTwinHTML(id, label) {
	const s = id.replace(/[^a-zA-Z0-9_-]/g, '_');
	return `<div id="twin-${id}" class="twin-semaforo" data-state="RED">
		<svg class="semaforo-svg" viewBox="0 0 120 370" xmlns="http://www.w3.org/2000/svg" aria-label="${label}">
			<defs>
				<radialGradient id="sheen-${s}" cx="30%" cy="25%" r="50%">
					<stop offset="0%" stop-color="rgba(255,255,255,0.18)"/>
					<stop offset="100%" stop-color="rgba(255,255,255,0)"/>
				</radialGradient>
				<linearGradient id="hsg-${s}" x1="0%" y1="0%" x2="100%" y2="0%">
					<stop offset="0%"   stop-color="#242424"/>
					<stop offset="14%"  stop-color="#3a3a3a"/>
					<stop offset="50%"  stop-color="#2e2e2e"/>
					<stop offset="86%"  stop-color="#262626"/>
					<stop offset="100%" stop-color="#181818"/>
				</linearGradient>
				<linearGradient id="pole-${s}" x1="0%" y1="0%" x2="100%" y2="0%">
					<stop offset="0%"   stop-color="rgba(255,255,255,0.22)"/>
					<stop offset="100%" stop-color="rgba(255,255,255,0.04)"/>
				</linearGradient>
			</defs>
			<rect x="36" y="0" width="48" height="16" rx="5" fill="#363636" stroke="#0d0d0d" stroke-width="1.5"/>
			<rect x="50" y="4"  width="20" height="8"  rx="3" fill="#2a2a2a"/>
			<rect x="8" y="14" width="104" height="260" rx="14" fill="url(#hsg-${s})" stroke="#0b0b0b" stroke-width="2.5"/>
			<rect x="11" y="17" width="98"  height="4" rx="2" fill="rgba(255,255,255,0.07)"/>
			<rect x="9"  y="16" width="3"   height="256" rx="2" fill="rgba(255,255,255,0.04)"/>
			<rect x="108" y="16" width="3"  height="256" rx="2" fill="rgba(0,0,0,0.25)"/>
			<rect x="11" y="267" width="98" height="5" fill="rgba(0,0,0,0.45)"/>
			<rect x="4" y="29" width="112" height="6"  rx="3" fill="rgba(0,0,0,0.5)"/>
			<rect x="4" y="28" width="112" height="13" rx="4" fill="#1e1e1e" stroke="#0d0d0d" stroke-width="1"/>
			<rect x="6" y="40" width="108" height="2"  rx="1" fill="#131313"/>
			<circle cx="60" cy="71" r="31" fill="#0b0b0b"/>
			<circle cx="60" cy="71" r="29" fill="#0e0e0e"/>
			<circle cx="60" cy="71" r="27" fill="#141010" class="twin-led twin-red"/>
			<circle cx="60" cy="71" r="27" fill="url(#sheen-${s})" pointer-events="none"/>
			<rect x="4" y="108" width="112" height="6"  rx="3" fill="rgba(0,0,0,0.5)"/>
			<rect x="4" y="107" width="112" height="13" rx="4" fill="#1e1e1e" stroke="#0d0d0d" stroke-width="1"/>
			<rect x="6" y="119" width="108" height="2"  rx="1" fill="#131313"/>
			<circle cx="60" cy="150" r="31" fill="#0b0b0b"/>
			<circle cx="60" cy="150" r="29" fill="#0e0e0e"/>
			<circle cx="60" cy="150" r="27" fill="#131108" class="twin-led twin-yellow"/>
			<circle cx="60" cy="150" r="27" fill="url(#sheen-${s})" pointer-events="none"/>
			<rect x="4" y="187" width="112" height="6"  rx="3" fill="rgba(0,0,0,0.5)"/>
			<rect x="4" y="186" width="112" height="13" rx="4" fill="#1e1e1e" stroke="#0d0d0d" stroke-width="1"/>
			<rect x="6" y="198" width="108" height="2"  rx="1" fill="#131313"/>
			<circle cx="60" cy="229" r="31" fill="#0b0b0b"/>
			<circle cx="60" cy="229" r="29" fill="#0e0e0e"/>
			<circle cx="60" cy="229" r="27" fill="#0d1309" class="twin-led twin-green"/>
			<circle cx="60" cy="229" r="27" fill="url(#sheen-${s})" pointer-events="none"/>
			<rect x="8"  y="260" width="104" height="14" fill="#1a1a1a"/>
			<rect x="10" y="272" width="100" height="8"  rx="4" fill="#141414" stroke="#0a0a0a" stroke-width="1"/>
			<rect x="44" y="278" width="32" height="18" rx="5" fill="#242424" stroke="#0d0d0d" stroke-width="1"/>
			<rect x="52" y="294" width="16" height="72" rx="8" fill="#1e1e1e"/>
			<rect x="53" y="294" width="6"  height="72" rx="3" fill="url(#pole-${s})"/>
		</svg>
		<div class="twin-label">${label}</div>
		<div><span class="twin-state-badge">Vermelho</span></div>
		<div id="countdown-${id}" class="twin-countdown">—</div>
	</div>`;
}

// ── CONFIG ───────────────────────────────────────────────────────────────────
const CONFIG = {
	broker: 'test.mosquitto.org',
	port: 8080,
	turma: 'TURMA',   // ← PREENCHER
	equipe: 'EQUIPE', // ← PREENCHER
	deviceIds: ['sem-a', 'sem-b'],
	deviceLabels: { 'sem-a': 'Semáforo A', 'sem-b': 'Semáforo B' },
	timings: { red: 5000, yellow: 3000, green: 5000, safetyInterval: 1000, min: 1000, max: 60000 },
	heartbeatInterval: 5000,
	watchdogTimeout: 15000,
};

const STATE_LABEL = {
	RED: 'Vermelho',
	YELLOW: 'Amarelo',
	GREEN: 'Verde',
	BLINK_YELLOW: 'Intermitente',
	SAFETY_RED: 'Segurança',
};

// ── CommandLog ────────────────────────────────────────────────────────────────
const CommandLog = (() => {
	const MAX = 500;
	const entries = [];

	function add(deviceId, origin, command, result, reason) {
		const entry = {
			timestamp: new Date().toISOString(),
			deviceId,
			origin,
			command,
			result: result || 'OK',
			reason: reason || '',
		};
		entries.unshift(entry);
		if (entries.length > MAX) entries.pop();
		_saveToSession();
		_renderLogTable();
		return entry;
	}

	function getAll() { return entries.slice(); }

	function _saveToSession() {
		try {
			sessionStorage.setItem('commandLog', JSON.stringify(entries.slice(0, MAX)));
		} catch (e) { /* storage unavailable — non-fatal */ }
	}

	function _escape(s) {
		return String(s).replace(/[&<>"']/g, (c) => ({
			'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
		})[c]);
	}

	function _rowClass(result) {
		if (result === 'OK') return 'log-result-ok';
		if (result === 'REJECTED') return 'log-result-rejected';
		return 'log-result-safe';
	}

	function _renderLogTable() {
		const tbody = document.getElementById('log-tbody');
		if (!tbody) return; // Elemento não existe mais, retorna sem erro
		const recent = entries.slice(0, 20);
		tbody.innerHTML = recent.map((e) => {
			const ts = new Date(e.timestamp).toLocaleTimeString('pt-BR');
			return `<tr>
				<td>${_escape(ts)}</td>
				<td><code>${_escape(e.deviceId)}</code></td>
				<td>${_escape(e.origin)}</td>
				<td>${_escape(e.command)}</td>
				<td class="${_rowClass(e.result)}">${_escape(e.result)}</td>
				<td>${_escape(e.reason)}</td>
			</tr>`;
		}).join('');
	}

	return { add, getAll }; // Removido _renderLogTable do export
})();

window.CommandLog = CommandLog;

// ── Shared runtime state ──────────────────────────────────────────────────────
const semaphores = {};
const watchdogs = {};
const deviceLastMqtt = {};
const deviceConnected = {};

// ── Crossing Coordination (RN01 / RN03) ───────────────────────────────────────
function coordinateCrossing(senderSem, partnerSems, onReady) {
	// RN01: every partner that is GREEN or YELLOW must be forced to RED first.
	const partners = Array.isArray(partnerSems) ? partnerSems : (partnerSems ? [partnerSems] : []);
	partners.forEach(p => {
		if (p && (p.state === 'GREEN' || p.state === 'YELLOW')) {
			CommandLog.add(p.id, 'SYSTEM', 'force_red', 'OK', 'RN01: conflito de verde');
			p.applyCommand('vermelho');
		}
	});

	// RN03: wait the safety interval before releasing GREEN.
	setTimeout(() => { onReady(); }, CONFIG.timings.safetyInterval);
}

// ── Twin DOM ──────────────────────────────────────────────────────────────────
function updateTwin(deviceId, state) {
	const el = document.getElementById('twin-' + deviceId);
	if (!el) return;

	el.dataset.state = state;
	el.querySelectorAll('.twin-led').forEach((l) => l.classList.remove('ligado'));
	el.classList.remove('blink-yellow');

	if (state === 'BLINK_YELLOW') {
		// CSS animation on .blink-yellow drives the actual visual blink.
		el.classList.add('blink-yellow');
	} else {
		const map = { RED: 'twin-red', YELLOW: 'twin-yellow', GREEN: 'twin-green', SAFETY_RED: 'twin-red' };
		const ledClass = map[state];
		if (ledClass) {
			const led = el.querySelector('.' + ledClass);
			if (led) led.classList.add('ligado');
		}
	}

	const badge = el.querySelector('.twin-state-badge');
	if (badge) badge.textContent = STATE_LABEL[state] || state;
}

function updateStatusCard(deviceId, state, lastMqtt) {
	const card = document.getElementById('status-' + deviceId);
	if (!card) return;

	const stateEl = card.querySelector('.card-state');
	const mqttEl = card.querySelector('.card-last-mqtt');

	if (stateEl) stateEl.textContent = STATE_LABEL[state] || state;
	if (mqttEl && lastMqtt) mqttEl.textContent = new Date(lastMqtt).toLocaleTimeString('pt-BR');

	// Persist for status.html to read
	try {
		const all = JSON.parse(sessionStorage.getItem('deviceStatus') || '{}');
		all[deviceId] = { state, lastMqtt, ts: Date.now() };
		sessionStorage.setItem('deviceStatus', JSON.stringify(all));
	} catch {}
}

// ── Countdown ─────────────────────────────────────────────────────────────────
function startCountdownTick() {
	setInterval(() => {
		CONFIG.deviceIds.forEach((id) => {
			const sem = semaphores[id];
			if (!sem) return;
			const el = document.getElementById('countdown-' + id);
			if (!el) return;
			if (sem.state === 'BLINK_YELLOW' || sem.state === 'SAFETY_RED') {
				el.textContent = '—';
				return;
			}
			el.textContent = Math.ceil(sem.remainingMs / 1000) + 's';
		});
	}, 200);
}

// ── Watchdog (RN04) ───────────────────────────────────────────────────────────
function resetWatchdog(deviceId) {
	deviceLastMqtt[deviceId] = Date.now();
	deviceConnected[deviceId] = true;
	clearTimeout(watchdogs[deviceId]);
	watchdogs[deviceId] = setTimeout(() => {
		deviceConnected[deviceId] = false;
		const sem = semaphores[deviceId];
		if (sem) {
			sem.enterSafeState();
			CommandLog.add(deviceId, 'SYSTEM', 'watchdog_timeout', 'SAFE_STATE', 'RN04: sem heartbeat por 15s');
		}
		updateStatusCard(deviceId, 'BLINK_YELLOW', deviceLastMqtt[deviceId]);
	}, CONFIG.watchdogTimeout);
}

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
	// Read devices from localStorage; fall back to CONFIG if storage is empty.
	const _storedDevices = window.Storage ? Storage.getDevices() : [];
	const _activeDevices = _storedDevices.length > 0
		? _storedDevices.map(d => ({
			id: d.id,
			nome: d.nome || d.id,
			timings: { red: d.tempoVermelho * 1000, yellow: d.tempoAmarelo * 1000, green: d.tempoVerde * 1000 },
		}))
		: CONFIG.deviceIds.map(id => ({ id, nome: CONFIG.deviceLabels[id] || id, timings: CONFIG.timings }));
	CONFIG.deviceIds = _activeDevices.map(d => d.id);
	const _deviceTimings = {};
	_activeDevices.forEach(d => { _deviceTimings[d.id] = Object.assign({}, CONFIG.timings, d.timings); });

	// Render SVG twins dynamically so any number of devices is supported.
	const _intersection = document.querySelector('.twin-intersection');
	if (_intersection) {
		_intersection.innerHTML = _activeDevices.map(d => buildTwinHTML(d.id, d.nome)).join('');
	}

	// Create the MQTT client first so onStateChange can publish through it.
	const mqttClient = new MqttClient({
		broker: CONFIG.broker,
		port: CONFIG.port,
		turma: CONFIG.turma,
		equipe: CONFIG.equipe,
		deviceIds: CONFIG.deviceIds,
		heartbeatInterval: CONFIG.heartbeatInterval,
	});
	window._mqttClient = mqttClient;

	// RN06: instantiate and start simulators immediately (local-first).
	CONFIG.deviceIds.forEach((id, idx) => {
		const sem = new Semaforo(id, _deviceTimings[id] || CONFIG.timings, (devId, newState, prevState) => {
			updateTwin(devId, newState);
			updateStatusCard(devId, newState, deviceLastMqtt[devId]);

			// RN07: log every real transition (blink ticks are cosmetic, skip them).
			if (newState !== 'BLINK_YELLOW' || prevState !== 'BLINK_YELLOW') {
				CommandLog.add(devId, 'SIMULATOR', newState, 'OK', '');
			}

			// Publish device state over MQTT when connected.
			const mc = window._mqttClient;
			if (mc && mc.connected) {
				mc.publish(devId, 'estado', {
					estado: newState,
					ts: Date.now(),
					remainingMs: semaphores[devId] ? semaphores[devId].remainingMs : 0,
				});
			}

			// Update crossing slot if this device is placed there (desabilitado - cruzamento removido)
			// Object.entries(_crossingLayout).forEach(([pos, slotId]) => {
			// 	if (slotId === devId && _slotCallbacks[pos]) _slotCallbacks[pos](newState);
			// });
		});

		// Stagger: A começa em RED (fase 2 no ciclo GREEN→YELLOW→RED), B começa em GREEN (fase 0).
		if (idx === 0) {
			sem._phase = 2;
			sem._doTransition('RED');
		} else if (idx === 1) {
			sem._doTransition('GREEN'); // fase 0 já é o padrão do constructor
		}

		semaphores[id] = sem;
		deviceConnected[id] = false;
	});

	// Wire crossing coordination: before any device goes GREEN, force all others to RED.
	CONFIG.deviceIds.forEach((id) => {
		semaphores[id]._awaitCrossing = (onReady) => {
			const partners = CONFIG.deviceIds
				.filter(pid => pid !== id)
				.map(pid => semaphores[pid]);
			coordinateCrossing(semaphores[id], partners, onReady);
		};
	});

	// Start every simulator.
	CONFIG.deviceIds.forEach((id) => semaphores[id].start());

	startCountdownTick();
	// initCrossing(); // Removido - cruzamento interativo não existe mais

	// ── MQTT lifecycle handlers ──────────────────────────────────────────────
	mqttClient.onConnect = () => {
		CommandLog.add('SISTEMA', 'SYSTEM', 'mqtt_connect', 'OK', 'Broker online');
		CONFIG.deviceIds.forEach((id) => {
			['estado', 'comando', 'configuracao', 'falha', 'sincronizacao'].forEach((s) => {
				mqttClient.subscribe(id, s);
			});
		});
	};

	mqttClient.onDisconnect = () => {
		CommandLog.add('SISTEMA', 'SYSTEM', 'mqtt_disconnect', 'SAFE_STATE', 'RN04: conexão perdida');
		CONFIG.deviceIds.forEach((id) => {
			if (semaphores[id]) semaphores[id].enterSafeState();
			deviceConnected[id] = false;
			updateStatusCard(id, 'BLINK_YELLOW', deviceLastMqtt[id]);
		});
	};

	mqttClient.onMessage = (deviceId, suffix, payload) => {
		if (!CONFIG.deviceIds.includes(deviceId)) return;
		resetWatchdog(deviceId);

		const sem = semaphores[deviceId];
		if (!sem) return;

		if (suffix === 'sincronizacao') {
			deviceConnected[deviceId] = true;
			updateStatusCard(deviceId, sem.state, deviceLastMqtt[deviceId]);
			return;
		}

		if (suffix === 'estado') {
			if (payload.estado) updateTwin(deviceId, payload.estado);
			return;
		}

		if (suffix === 'comando') {
			const cmd = payload.cmd;
			if (!cmd) return;

			// RN10 / RN01: reject a GREEN request while any partner is GREEN/YELLOW.
			if (cmd === 'verde') {
				const blocked = CONFIG.deviceIds
					.filter(id => id !== deviceId)
					.some(pid => semaphores[pid] && (semaphores[pid].state === 'GREEN' || semaphores[pid].state === 'YELLOW'));
				if (blocked) {
					CommandLog.add(deviceId, 'MQTT', `cmd:${cmd}`, 'REJECTED', 'RN01: parceiro ainda verde/amarelo');
					return;
				}
			}

			sem.applyCommand(cmd);
			CommandLog.add(deviceId, 'MQTT', `cmd:${cmd}`, 'OK', '');
			return;
		}

		if (suffix === 'configuracao') {
			sem.setTimings(payload);
			CommandLog.add(deviceId, 'MQTT', 'configurar', 'OK', JSON.stringify(payload));
			return;
		}

		if (suffix === 'falha') {
			sem.enterSafeState();
			CommandLog.add(deviceId, 'MQTT', `falha:${payload.luz || '?'}`, 'SAFE_STATE', 'RN09: falha de luz');
			updateStatusCard(deviceId, 'BLINK_YELLOW', deviceLastMqtt[deviceId]);
			return;
		}
	};

	mqttClient.connect();
});
