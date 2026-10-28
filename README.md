# Hello Kitty Pool Club 🎀🎱

Sinuca 8-ball 2D para navegador, com visual kawaii, bots (fácil/médio/difícil) e multiplayer online com servidor autoritativo.
Nome provisório. Os personagens são personagens com as imagens em `client/assets/characters/` (8 personagens; veja `client/config.js`). Se uma imagem faltar, o jogo usa um emoji no lugar.

## Instalar e rodar
```bash
npm install
npm start          # http://localhost:3000
npm test           # regras, faltas, física, bots e integração multiplayer
```
Requer Node.js 18+. Abra `http://localhost:3000` em Chrome, Edge, Firefox ou Opera.

## Como jogar
Arraste (ou passe o mouse) sobre a mesa para mirar, ajuste a força no controle deslizante e toque em **Tacar** (ou Espaço/Enter). **✖** ou Esc cancela a mira. Com *bola na mão*, arraste a bola branca para posicioná-la (na quebra, só atrás da linha).

## Testar dois jogadores na mesma rede
1. `npm start` no computador e descubra o IP local (`ipconfig` / `ifconfig`), ex.: `192.168.0.10`.
2. No celular (mesmo Wi-Fi) abra `http://192.168.0.10:3000`.
3. Em um aparelho: **Jogar com amigo → Criar sala privada**; no outro, digite o código (ou abra o link copiado) e ambos tocam em **Estou pronto(a)**. **Jogar online** faz pareamento aleatório.

## Publicar na internet
Use um serviço com Node.js e WebSocket (Render, Railway, Fly.io, VPS). Build: `npm install`; start: `npm start`. O servidor também serve o frontend. Hospedagem estática pura **não** funciona. Use HTTPS (o `wss` é automático).

| Variável | Padrão | Uso |
|---|---|---|
| `PORT` | 3000 | Porta HTTP/WebSocket (provedores definem sozinhos) |
| `CORS_ORIGIN` | desativado | Só se o frontend ficar em outro domínio |
| `UPSTASH_REDIS_REST_URL` | — | URL REST do banco Upstash (ranking permanente) |
| `UPSTASH_REDIS_REST_TOKEN` | — | Token REST do banco Upstash |
| `RANKING_FILE` | data/ranking.json | Arquivo do ranking quando o Upstash não está configurado |
| `RECONNECT_MS` | 45000 | Tempo para reconectar antes de perder por desconexão |

## Arquitetura
- `shared/physics.js` física determinística (passo fixo 1/240 s), `shared/rules.js` regras 8-ball, `shared/bot.js` bots. Rodam no servidor, no cliente e nos testes.
- `server/index.js` HTTP estático + Socket.IO; `server/rooms/rooms.js` salas, convites, matchmaking, reconexão, validação de tacadas.
- Fluxo online: o cliente envia só a *intenção* (ângulo, força, posição da branca); o servidor valida turno/posição, simula e devolve os quadros + novo estado; ambos reproduzem a mesma animação.
- `client/` interface (canvas 2D), mira com previsão, temas de mesa, perfil (nível, moedas, V/D em `localStorage`).

## Ranking online
Botão **🏆 Ranking** na tela inicial: top 50 por vitórias (desempate: menos derrotas), com nome, nível, vitórias e derrotas; o seu lugar aparece destacado (mesmo fora do top 50).
- Só contam partidas **online** (Jogar online e Jogar com amigo). Contra o bot é treino: não conta V/D nem XP.
- Nível = `floor(XP/100)+1`; vitória online = 30 XP, derrota = 10 XP. Tudo é calculado no servidor (`server/ranking.js`), que identifica o jogador pelo token do navegador (nunca enviado ao ranking).
- **Persistência no Render (plano free):** o disco é apagado quando o servidor desliga, então o ranking fica no **Upstash Redis** (grátis). Configure as variáveis `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` (veja abaixo). Sem elas, usa o arquivo local `data/ranking.json` (só para desenvolvimento). Se o banco estiver configurado mas fora do ar na inicialização, o servidor não sobe (evita começar vazio e sobrescrever o ranking).

## Limitações da primeira versão
Efeito (spin) na bola branca, Phaser/Matter.js (usei canvas 2D e física própria), arte oficial, histórico de partidas e skins ainda não existem. Moedas e personalização são locais. Sem apostas com dinheiro real.
