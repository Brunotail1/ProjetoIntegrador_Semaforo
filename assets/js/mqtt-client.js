'use strict';

/*
 * Cliente MQTT - gerencia conexão com broker e publicação/assinatura de tópicos
 * Padrão dos tópicos: aps1/semaforo/<turma>/<equipe>/<deviceId>/<sufixo>
 */
class MqttClient {
	constructor(config) {
		// config = { broker, port, turma, equipe, deviceIds, heartbeatInterval }
		this.config = config;
		this.client = null;
		this._reconnectDelay = 2000;
		this._reconnectTimer = null;
		this._heartbeatTimer = null;
		this._subscribedTopics = []; // guarda tópicos pra reassinar depois de reconectar

		// Callbacks customizados
		this.onConnect = null;
		this.onDisconnect = null;
		this.onMessage = null; // recebe (deviceId, suffix, payload)
	}

	// Conecta no broker via WebSocket
	connect() {
		const url = `ws://${this.config.broker}:${this.config.port}/mqtt`;
		const clientId = `semaforo_web_${Math.random().toString(16).slice(2, 10)}`;

		this.client = mqtt.connect(url, { clientId, clean: true, connectTimeout: 8000 });

		this.client.on('connect', () => {
			this._reconnectDelay = 2000;
			clearTimeout(this._reconnectTimer);
			this._startHeartbeat();
			if (this.onConnect) this.onConnect();
			// Reassina todos os tópicos após reconexão
			this._subscribedTopics.forEach((t) => this.client.subscribe(t));
		});

		this.client.on('close', () => {
			this._stopHeartbeat();
			if (this.onDisconnect) this.onDisconnect();
			this._scheduleReconnect();
		});

		this.client.on('error', () => {
			this._stopHeartbeat();
			if (this.onDisconnect) this.onDisconnect();
		});

		// Recebe mensagens e parseia JSON
		this.client.on('message', (topic, message) => {
			let payload;
			try {
				payload = JSON.parse(message.toString());
			} catch (e) {
				return; // ignora payloads mal formatados
			}
			const parts = topic.split('/');
			const deviceId = parts[4]; // extrai deviceId do tópico
			const suffix = parts[5];   // extrai sufixo (comando, estado, etc)
			if (this.onMessage) this.onMessage(deviceId, suffix, payload);
		});
	}

	// Desconecta e limpa tudo
	disconnect() {
		clearTimeout(this._reconnectTimer);
		this._stopHeartbeat();
		if (this.client) {
			this.client.end(true);
			this.client = null;
		}
		this._subscribedTopics = [];
	}

	// Publica mensagem em um tópico específico
	publish(deviceId, suffix, payload) {
		if (!this.client) return;
		this.client.publish(this._buildTopic(deviceId, suffix), JSON.stringify(payload));
	}

	// Assina um tópico pra receber mensagens
	subscribe(deviceId, suffix) {
		const topic = this._buildTopic(deviceId, suffix);
		if (!this._subscribedTopics.includes(topic)) {
			this._subscribedTopics.push(topic);
		}
		if (this.client) {
			this.client.subscribe(topic);
		}
	}

	// Monta o tópico seguindo padrão do projeto
	_buildTopic(deviceId, suffix) {
		const { turma, equipe } = this.config;
		return `aps1/semaforo/${turma}/${equipe}/${deviceId}/${suffix}`;
	}

	// Envia heartbeat periódico pros semáforos
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

	// Tenta reconectar com backoff exponencial
	_scheduleReconnect() {
		clearTimeout(this._reconnectTimer);
		this._reconnectTimer = setTimeout(() => {
			if (this.client) {
				this.client.reconnect();
			}
		}, this._reconnectDelay);
		this._reconnectDelay = Math.min(this._reconnectDelay * 2, 30000); // max 30s
	}
}

if (typeof window !== 'undefined') window.MqttClient = MqttClient;
if (typeof module !== 'undefined' && module.exports) module.exports = { MqttClient };
