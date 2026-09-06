const mario = document.querySelector('.mario');
const pipe = document.querySelector('.pipe');

const start = document.querySelector('.start');
const gameOver = document.querySelector('.game-over');

const audioStart = new Audio('./img/sound/audio-theme.mp3');
const audioGameOver = new Audio('./img/sound/audio-gameover.mp3');

// Guarda o ID do setInterval pra dar pra parar de verdade. `clearInterval(loop)` (o código
// antigo) não funciona: clearInterval precisa do ID que setInterval devolve, não da função.
let loopId = null;

const startGame = () => {
  pipe.classList.add('pipe-animation');
  start.style.display = 'none';

  audioStart.currentTime = 0;
  audioStart.play();

  loop();
};

const restartGame = () => {
  gameOver.style.display = 'none';

  pipe.style.left = '';
  pipe.style.right = '';
  pipe.classList.add('pipe-animation');

  mario.classList.remove('jump');
  mario.src = './img/mario.gif';
  mario.style.width = '150px';
  mario.style.marginLeft = '';
  mario.style.bottom = '0';

  audioGameOver.pause();
  audioGameOver.currentTime = 0;

  audioStart.currentTime = 0;
  audioStart.play();

  loop();
};

const jump = () => {
  // Sem essa checagem, apertar espaço várias vezes rápido reiniciava a animação de pulo no meio
  // do ar, o Mario "tremia" em vez de pular limpo.
  if (mario.classList.contains('jump')) return;

  mario.classList.add('jump');

  setTimeout(() => {
    mario.classList.remove('jump');
  }, 800);
};

const loop = () => {
  loopId = setInterval(() => {
    const pipePosition = pipe.offsetLeft;
    const marioPosition = parseInt(window.getComputedStyle(mario).bottom, 10);

    if (pipePosition <= 120 && pipePosition > 0 && marioPosition < 80) {
      // Congela o cano na posição atual antes de tirar a animação. O cano se move via `right`
      // (ver styles.css), então precisa travar em `right`, não em `left` — travar em `left`
      // (o código antigo) não tinha efeito nenhum na posição visual dele.
      const pipeRight = window.getComputedStyle(pipe).right;
      pipe.classList.remove('pipe-animation');
      pipe.style.right = pipeRight;

      mario.classList.remove('jump');
      mario.style.bottom = `${marioPosition}px`;

      mario.src = './img/game-over.png';
      mario.style.width = '80px';
      mario.style.marginLeft = '50px';

      audioStart.pause();

      audioGameOver.currentTime = 0;
      audioGameOver.play();
      setTimeout(() => audioGameOver.pause(), 7000);

      gameOver.style.display = 'flex';

      clearInterval(loopId);
    }
  }, 10);
};

document.addEventListener('keypress', (e) => {
  if (e.key === ' ') {
    jump();
  }
  if (e.key === 'Enter') {
    startGame();
  }
});

document.addEventListener('touchstart', (e) => {
  if (e.touches.length) {
    jump();
  }
});
