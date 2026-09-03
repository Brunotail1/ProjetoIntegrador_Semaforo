'use strict';

/*
 * mqtt-client.js — Thin adapter over MQTT.js (global `mqtt`, loaded via
 * mqtt.min.js). Handles connection lifecycle, topic building, heartbeat
 * publishing and re-subscription after reconnect.
 *
 * Topic convention:  aps1/semaforo/<turma>/<equipe>/<deviceId>/<suffix>
 */
class MqttClient {
	constructor(config) {
		this.config = config; // { broker, port, turma, equipe, deviceIds, heartbeatInterval }
		this.client = null;
		this.connected = false;

		this._reconnectDelay = 2000;
		this._reconnectTimer = null;
		this._heartbeatTimer = null;
		this._subscribedTopics = [];

		this.onConnect = null;
		this.onDisconnect = null;
		this.onMessage = null; // (deviceId, suffix, payload)
	}

	connect() {
		const url = `ws://${this.config.broker}:${this.config.port}/mqtt`;
		const clientId = `semaforo_web_${Math.random().toString(16).slice(2, 10)}`;

		this.client = mqtt.connect(url, { clientId, clean: true, connectTimeout: 8000 });

		this.client.on('connect', () => {
			this.connected = true;
			this._reconnectDelay = 2000;
			clearTimeout(this._reconnectTimer);
			this._startHeartbeat();
			if (this.onConnect) this.onConnect();
			// Re-subscribe to everything after a (re)connect.
			this._subscribedTopics.forEach((t) => this.client.subscribe(t));
		});

		this.client.on('close', () => {
			if (!this.connected) return;
			this.connected = false;
			this._stopHeartbeat();
			if (this.onDisconnect) this.onDisconnect();
			this._scheduleReconnect();
		});

		this.client.on('error', () => {
			// MQTT.js drives its own reconnect loop; we just surface disconnect.
			if (this.connected) {
				this.connected = false;
				this._stopHeartbeat();
				if (this.onDisconnect) this.onDisconnect();
			}
		});

		this.client.on('message', (topic, message) => {
			let payload;
			try {
				payload = JSON.parse(message.toString());
			} catch (e) {
				return; // ignore malformed payloads
			}
			const parts = topic.split('/');
			const deviceId = parts[4];
			const suffix = parts[5];
			if (this.onMessage) this.onMessage(deviceId, suffix, payload);
		});
	}

	disconnect() {
		clearTimeout(this._reconnectTimer);
		this._stopHeartbeat();
		if (this.client) {
			this.client.end(true);
			this.client = null;
		}
		this.connected = false;
		this._subscribedTopics = [];
	}

	publish(deviceId, suffix, payload) {
		if (!this.connected || !this.client) return;
		this.client.publish(this._buildTopic(deviceId, suffix), JSON.stringify(payload));
	}

	subscribe(deviceId, suffix) {
		const topic = this._buildTopic(deviceId, suffix);
		if (!this._subscribedTopics.includes(topic)) {
			this._subscribedTopics.push(topic);
		}
		if (this.connected && this.client) {
			this.client.subscribe(topic);
		}
	}

	_buildTopic(deviceId, suffix) {
		const { turma, equipe } = this.config;
		return `aps1/semaforo/${turma}/${equipe}/${deviceId}/${suffix}`;
	}

	_startHeartbeat() {
		this._stopHeartbeat();
		this._heartbeatTimer = setInterval(() => {
			(this.config.deviceIds || []).forEach((id) => {
				this.publish(id, 'sincronizacao', { status: 'ok', ts: Date.now() });
			});
		}, this.config.heartbeatInterval || 5000);
	}

	_stopHeartbeat() {
		clearInterval(this._heartbeatTimer);
		this._heartbeatTimer = null;
	}

	_scheduleReconnect() {
		clearTimeout(this._reconnectTimer);
		this._reconnectTimer = setTimeout(() => {
			if (!this.connected && this.client) {
				this.client.reconnect();
			}
		}, this._reconnectDelay);
		this._reconnectDelay = Math.min(this._reconnectDelay * 2, 30000);
	}
}

if (typeof window !== 'undefined') window.MqttClient = MqttClient;
if (typeof module !== 'undefined' && module.exports) module.exports = { MqttClient };
