# Mario Runner

> **Demo ao vivo:** _(preencher depois do deploy)_

Jogo estilo "corredor infinito" (igual o dinossauro do Chrome), tema Mario: pula o cano que vem
correndo, e o jogo acelera até você errar. Feito em HTML, CSS e JavaScript puro, sem framework,
sem dependência, sem build. É projeto de estudo/hobby, não um produto de cliente — fica separado
dos projetos de serviço no portfólio por isso.

## Como jogar

Abre `index.html` no navegador (ou serve como site estático, é só HTML/CSS/JS puro).

- **Espaço**: pula.
- **Enter**: começa o jogo.
- Em celular: toque na tela pula.
- Bateu no cano: mostra "Game Over", clica em "Reiniciar" pra jogar de novo.

## O que foi corrigido

Peguei o repositório com alguns bugs reais de funcionamento e corrigi:

1. **Caminho de áudio e imagem errado**: `script.js` apontava pra `./src/audio/...` e
   `./src/img/...`, pastas que não existem no projeto (os arquivos reais estão em `img/` e
   `img/sound/`, este segundo renomeado de `img/soung/`, que tinha erro de digitação). Resultado
   prático: nem o som nem a troca de imagem do "game over" funcionavam, sempre dava 404 silencioso.
2. **`clearInterval(loop)` não parava o jogo de verdade**: `clearInterval` precisa do ID numérico
   que `setInterval` devolve, não da função em si. Passar a função não tem efeito, então depois
   de um "Game Over" o loop de checagem de colisão continuava rodando escondido pra sempre a
   cada 10ms.
3. **`classList.remove('.jump')` e `.remove('.pipe-animation')`**: com ponto no início, essas
   chamadas nunca removem as classes de verdade (o nome da classe é `jump`, não `.jump`). O
   congelamento do Mario e do cano no momento da colisão não funcionava.
4. **Reiniciar não reativava o jogo**: depois do primeiro "Game Over", clicar em "Reiniciar"
   escondia a tela de game over mas nunca voltava a mover o cano nem a checar colisão, porque
   nada reativava a classe de animação nem chamava o loop de novo.

Testado com Playwright (Chromium headless): sem erro de console, sem requisição 404, pulo,
colisão e reinício conferidos na prática antes de considerar corrigido.

## Estrutura

```
index.html      estrutura da tela (jogo + tela de game over)
styles.css      visual e animações (CSS puro, @keyframes pro pulo e pro cano)
script.js       lógica do jogo: iniciar, pular, checar colisão, reiniciar
img/            imagens e sons do jogo
```

## Limitações conhecidas

- Sem pontuação, sem dificuldade progressiva, sem múltiplos obstáculos. É a versão mínima do
  conceito, não um jogo completo.
- Sem persistência de recorde (fecha a aba, esquece o que jogou).
