const fields = document.querySelectorAll('.game-field');

const player_state = {
    player: 1,
    color: 'orange',
    choice: [],
    game_calculator: {}
    }

const interface_state = {
    draggable: null
    };

class GameCalculator {
    constructor(){
        this.situation = new Map( [[1,new Set()],[2,new Set()],[3,new Set()]] );
        this.field = 12;
        }
    addChoice(player,choice){
        return this.situation[player].add(choice);
        }
    removeChoice(player,choice){
        return this.situation[player].delete(choice);
        }
    
    getPayoff(player){
        let p = this.situation[player].size,
            A = 0;
        for( const [key, el] of this.situation ){
            A += el.size;
            }
        return A;
        }
    
    sendChoice(){

    }

}

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
        player_state.game_calculator.removeChoice( player_state.player, oldplace.id );
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
        player_state.game_calculator.addChoice( player_state.player, newplace.id );
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