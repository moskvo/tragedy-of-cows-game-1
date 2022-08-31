const fields = document.querySelectorAll('.game-field');

const player_state = {
    player: 1,
    color: 'orange'
    }

const interface_state = {
    draggable: null
    };

document.querySelectorAll('.droppable').forEach((v)=>{
    v.addEventListener('drop',drop);
    v.addEventListener('dragover',allowDrop);
    })

const cows = document.querySelectorAll('.cow');
const cows_conf = new Map();
cows.forEach( (v,i) => {
    v.addEventListener('dragstart',dragstart);
    v.setAttribute('draggable', true);
    v.classList.add('player-'+player_state.player);
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

function drop(event) {
    event.preventDefault();
    //let card_id = ev.dataTransfer.getData("text");
    let card = interface_state.draggable;// document.getElementById(card_id);
    let oldplace = card.closest('.droppable');

    // взять элемент на данных координатах
    //let elem = document.elementFromPoint(ev.clientX, ev.clientY);
    // найти ближайший сверху droppable
    let newplace = event.target.closest('.droppable');

    newplace.appendChild(card);
    if ( oldplace.classList.contains('game-field') ) {
        oldplace.addEventListener('drop',drop);
        oldplace.addEventListener('dragover',allowDrop); 
        }
    if( newplace.classList.contains('choice-set') ){
        card.style.left = cows_conf.get(card.id).left;
        card.removeAttribute('graze');
        }
    else { 
        card.style.left = 0 + 'px';
        card.setAttribute('graze',true);
        newplace.removeEventListener('drop',drop);
        newplace.removeEventListener('dragover',allowDrop); 
        }

    //ev.target.appendChild(document.getElementById(data));
    }

function allowDrop(ev) { ev.preventDefault(); }

function dragstart(ev) {
    ev.dataTransfer.setData("text", ev.target.id);
    interface_state.draggable = ev.target;
    }


/*(function shuffle() {
  cards.forEach(card => {
    let randomPos = Math.floor(Math.random() * 12);
    card.style.order = randomPos;
  });
})();

cards.forEach(card => card.addEventListener('click', flipCard));*/

/*
*   game logic
*/

function cards_on_field() {
    let cards = [];
    cows.forEach((v)=>{
        if( v.hasAttribute('graze') && v.classList.contains('player-'+player_state.player) ) { cards.push(v); }
        });
    return cards;
    }