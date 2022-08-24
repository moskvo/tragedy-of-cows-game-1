const fields = document.querySelectorAll('.game-field');

document.querySelectorAll('.droppable').forEach((v)=>{
    v.addEventListener('drop',drop);
    v.addEventListener('dragover',allowDrop); 
    })

const cows = document.querySelectorAll('.cow');
cows.forEach(v=>{
    v.addEventListener('dragstart',dragstart);
    v.setAttribute('draggable', true);
    })

const choice_set = document.querySelector('.cows-choice');
choice_set.querySelectorAll('.cow').forEach((v,i)=>{v.style.left = i*50 + 'px';});

function unflipCards() {
  lockBoard = true;

  setTimeout(() => {
    firstCard.classList.remove('flip');
    secondCard.classList.remove('flip');

    resetBoard();
  }, 1500);
}

function resetBoard() {
  [hasFlippedCard, lockBoard] = [false, false];
  [firstCard, secondCard] = [null, null];
}

function drop(ev) {
    ev.preventDefault();
    var data = ev.dataTransfer.getData("text");

    // взять элемент на данных координатах
    var elem = document.elementFromPoint(event.clientX, event.clientY);

    // найти ближайший сверху droppable
    let el = elem.closest('.droppable');

    el.appendChild(document.getElementById(data));

    //ev.target.appendChild(document.getElementById(data));
    }

function allowDrop(ev) {
    ev.preventDefault();
    }

function dragstart(ev) {
    ev.dataTransfer.setData("text", ev.target.id);
    }


/*(function shuffle() {
  cards.forEach(card => {
    let randomPos = Math.floor(Math.random() * 12);
    card.style.order = randomPos;
  });
})();

cards.forEach(card => card.addEventListener('click', flipCard));*/
