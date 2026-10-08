# Back-end do Semáforo (MQTT)

Back-end em Node.js que envia configurações ao semáforo e recebe a situação atual e as falhas via MQTT.
O semáforo (ESP32) é simulado pelo **MQTTX**.

## Como rodar

Dentro da pasta `backend`:

```bash
npm install
npm start
```

> No PowerShell, se der erro de "running scripts is disabled", use `npm.cmd start` ou `node server.js`.

Abra **http://localhost:3000** para usar a tela.

## Configurar o MQTTX (simula o semáforo)

1. **New Connection** → Host `mqtt://test.mosquitto.org`, Port `1883` → **Connect**
2. **New Subscription** → `aps1/semaforo/TURMA/EQUIPE/sem-a/#`

## Tópicos MQTT

Base: `aps1/semaforo/TURMA/EQUIPE/<id>/` (o `<id>` é o mesmo do campo "ID do semáforo" da tela, ex.: `sem-a`)

| Sentido | Tópico | Mensagem (JSON) |
|---|---|---|
| Back-end → semáforo | `.../sem-a/configuracao` | `{"vermelho":5,"amarelo":3,"verde":5}` (segundos) |
| Semáforo → back-end | `.../sem-a/estado` | `{"estado":"GREEN"}` (`RED`, `YELLOW`, `GREEN` ou `BLINK_YELLOW`) |
| Semáforo → back-end | `.../sem-a/falha` | `{"luz":"vermelho"}` |

## Testando

1. **Enviar configuração:** na tela, preencha os tempos e clique em **Enviar** → a mensagem chega no MQTTX.
2. **Enviar estado:** no MQTTX, publique `{"estado":"GREEN"}` em `aps1/semaforo/TURMA/EQUIPE/sem-a/estado` → aparece na tela.
3. **Enviar falha:** no MQTTX, publique `{"luz":"vermelho"}` em `aps1/semaforo/TURMA/EQUIPE/sem-a/falha` → aparece na tela.

## Rotas HTTP

- `POST /semaforos/:id/configuracao` — envia a configuração ao semáforo
- `GET /semaforos/:id/status` — mostra a situação atual e as falhas recebidas
