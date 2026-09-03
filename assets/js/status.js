'use strict';
document.addEventListener('DOMContentLoaded', () => {
  const STATE_LABEL = {
    RED:'Vermelho', YELLOW:'Amarelo', GREEN:'Verde',
    BLINK_YELLOW:'Intermitente', SAFETY_RED:'Segurança',
  };

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

      if (stateEl) stateEl.textContent = STATE_LABEL[d.state] || d.state;
      if (mqttEl && d.lastMqtt) mqttEl.textContent = new Date(d.lastMqtt).toLocaleTimeString('pt-BR');
      if (connEl) {
        connEl.textContent = d.connected ? 'Conectado' : 'Desconectado';
        connEl.className = 'card-connection ' + (d.connected ? 'log-result-ok' : 'log-result-rejected');
      }
      if (ageEl && d.ts) {
        const age = Math.round((Date.now() - d.ts) / 1000);
        ageEl.textContent = age < 60 ? age + 's atrás' : Math.round(age/60) + 'min atrás';
      }
    });
  }

  refresh();
  setInterval(refresh, 2000);
});
