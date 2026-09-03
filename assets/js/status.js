'use strict';

// Atualiza status dos semáforos na página status.html
document.addEventListener('DOMContentLoaded', () => {
  // Tradução dos estados
  const STATE_LABEL = {
    RED:'Vermelho', YELLOW:'Amarelo', GREEN:'Verde',
    BLINK_YELLOW:'Intermitente', SAFETY_RED:'Segurança',
  };

  // Atualiza cards com dados do sessionStorage
  function refresh() {
    let status = {};
    try { status = JSON.parse(sessionStorage.getItem('deviceStatus') || '{}'); } catch {}

    ['sem-a','sem-b'].forEach(id => {
      const d = status[id];
      const card = document.getElementById('status-' + id);
      if (!card || !d) return;

      const stateEl = card.querySelector('.card-state');
      const mqttEl  = card.querySelector('.card-last-mqtt');
      const connEl  = card.querySelector('.card-connection');
      const ageEl   = card.querySelector('.card-age');

      // Atualiza estado atual
      if (stateEl) stateEl.textContent = STATE_LABEL[d.state] || d.state;
      
      // Atualiza horário da última msg MQTT
      if (mqttEl && d.lastMqtt) mqttEl.textContent = new Date(d.lastMqtt).toLocaleTimeString('pt-BR');
      
      // Status de conexão
      if (connEl) {
        connEl.textContent = d.connected ? 'Conectado' : 'Desconectado';
        connEl.className = 'card-connection ' + (d.connected ? 'log-result-ok' : 'log-result-rejected');
      }
      
      // Tempo desde última atualização
      if (ageEl && d.ts) {
        const age = Math.round((Date.now() - d.ts) / 1000);
        ageEl.textContent = age < 60 ? age + 's atrás' : Math.round(age/60) + 'min atrás';
      }
    });
  }

  refresh();
  setInterval(refresh, 2000); // atualiza a cada 2s
});
