'use strict';

/*
 * Cliente MQTT — gerencia a conexão com o broker e a publicação/assinatura de tópicos.
 * Padrão dos tópicos: aps1/semaforo/<turma>/<equipe>/<idDispositivo>/<sufixo>
 */
class ClienteMqtt {
	constructor(configuracao) {
		// configuracao = { broker, porta, turma, equipe, idsDispositivos, intervaloSincronismo }
		this.configuracao = configuracao;
		this.cliente = null;
		this.conectado = false;

		this._intervaloReconexao = 2000;
		this._temporizadorReconexao = null;
		this._temporizadorSincronismo = null;
		this._topicosAssinados = []; // guarda os tópicos pra reassinar depois de reconectar

		// Callbacks customizados
		this.aoConectar = null;
		this.aoDesconectar = null;
		this.aoReceberMensagem = null; // recebe (idDispositivo, sufixo, payload)
	}

	// Conecta no broker via WebSocket
	conectar() {
		const url = `ws://${this.configuracao.broker}:${this.configuracao.porta}/mqtt`;
		const idCliente = `semaforo_web_${Math.random().toString(16).slice(2, 10)}`;

		this.cliente = mqtt.connect(url, { clientId: idCliente, clean: true, connectTimeout: 8000 });

		this.cliente.on('connect', () => {
			this.conectado = true;
			this._intervaloReconexao = 2000;
			clearTimeout(this._temporizadorReconexao);
			this._iniciarEnvioDeSincronismo();
			if (this.aoConectar) this.aoConectar();
			// Reassina todos os tópicos após a reconexão
			this._topicosAssinados.forEach((topico) => this.cliente.subscribe(topico));
		});

		this.cliente.on('close', () => {
			this.conectado = false;
			this._pararEnvioDeSincronismo();
			if (this.aoDesconectar) this.aoDesconectar();
			this._agendarReconexao();
		});

		this.cliente.on('error', () => {
			this.conectado = false;
			this._pararEnvioDeSincronismo();
			if (this.aoDesconectar) this.aoDesconectar();
		});

		// Recebe as mensagens e converte o payload de JSON
		this.cliente.on('message', (topico, mensagem) => {
			let payload;
			try {
				payload = JSON.parse(mensagem.toString());
			} catch {
				return; // ignora payloads mal formatados
			}
			const partes = topico.split('/');
			const idDispositivo = partes[4]; // extrai o id do dispositivo do tópico
			const sufixo = partes[5];        // extrai o sufixo (comando, estado, etc)
			if (this.aoReceberMensagem) this.aoReceberMensagem(idDispositivo, sufixo, payload);
		});
	}

	// Desconecta do broker e limpa tudo
	desconectar() {
		clearTimeout(this._temporizadorReconexao);
		this._pararEnvioDeSincronismo();
		if (this.cliente) {
			this.cliente.end(true);
			this.cliente = null;
		}
		this.conectado = false;
		this._topicosAssinados = [];
	}

	// Publica uma mensagem no tópico do dispositivo
	publicar(idDispositivo, sufixo, payload) {
		if (!this.cliente) return;
		this.cliente.publish(this._montarTopico(idDispositivo, sufixo), JSON.stringify(payload));
	}

	// Assina um tópico pra receber as mensagens dele
	assinar(idDispositivo, sufixo) {
		const topico = this._montarTopico(idDispositivo, sufixo);
		if (!this._topicosAssinados.includes(topico)) {
			this._topicosAssinados.push(topico);
		}
		if (this.cliente) {
			this.cliente.subscribe(topico);
		}
	}

	// Monta o tópico seguindo o padrão do projeto
	_montarTopico(idDispositivo, sufixo) {
		const { turma, equipe } = this.configuracao;
		return `aps1/semaforo/${turma}/${equipe}/${idDispositivo}/${sufixo}`;
	}

	// Envia o sinal periódico de sincronismo (heartbeat) pros semáforos
	_iniciarEnvioDeSincronismo() {
		this._pararEnvioDeSincronismo();
		this._temporizadorSincronismo = setInterval(() => {
			(this.configuracao.idsDispositivos || []).forEach((id) => {
				this.publicar(id, 'sincronizacao', { status: 'ok', ts: Date.now() });
			});
		}, this.configuracao.intervaloSincronismo || 5000);
	}

	_pararEnvioDeSincronismo() {
		clearInterval(this._temporizadorSincronismo);
		this._temporizadorSincronismo = null;
	}

	// Tenta reconectar com backoff exponencial (máximo de 30s entre tentativas)
	_agendarReconexao() {
		clearTimeout(this._temporizadorReconexao);
		this._temporizadorReconexao = setTimeout(() => {
			if (this.cliente) {
				this.cliente.reconnect();
			}
		}, this._intervaloReconexao);
		this._intervaloReconexao = Math.min(this._intervaloReconexao * 2, 30000);
	}
}

window.ClienteMqtt = ClienteMqtt;
