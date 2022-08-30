const fields = document.querySelectorAll('.game-field');

document.querySelectorAll('.droppable').forEach((v)=>{
    v.addEventListener('drop',drop);
    v.addEventListener('dragover',allowDrop); 
    })

const cows = document.querySelectorAll('.cow');
const cows_conf = new Map();
cows.forEach( (v,i) => {
    v.addEventListener('dragstart',dragstart);
    v.setAttribute('draggable', true);
    v.style.left = i*50 + 'px';
    cows_conf.set(v.id,{left:i*50 + 'px'})
    });

const choice_set = document.querySelector('.choice-set');

function unflipCards() {
  lockBoard = true;

  setTimeout(() => {
    firstCard.classList.remove('flip');
    secondCard.classList.remove('flip');

    resetBoard();
  }, 1500);
}

function resetBoard() {
    hasFlippedCard = lockBoard = false;
    firstCard = secondCard = null;
    }

function drop(ev) {
    ev.preventDefault();
    var data = ev.dataTransfer.getData("text");

    // взять элемент на данных координатах
    var elem = document.elementFromPoint(ev.clientX, ev.clientY);

    // найти ближайший сверху droppable
    let el = elem.closest('.droppable');

    let card = document.getElementById(data);
    let oldplace = card.closest('.droppable');
    el.appendChild(card);
    if( el.classList.contains('choice-set') ){
        card.style.left = cows_conf.get(card.id).left;
        oldplace.addEventListener('drop',drop);
        oldplace.addEventListener('dragover',allowDrop); 
        }
    else { 
        card.style.left = 0 + 'px';
        el.removeEventListener('drop',drop);
        el.removeEventListener('dragover',allowDrop); 
        }

    //ev.target.appendChild(document.getElementById(data));
    }

function allowDrop(ev) { ev.preventDefault(); }

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
