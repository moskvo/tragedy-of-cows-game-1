document.addEventListener("DOMContentLoaded", function(event) {
    let tgame = new TragedyOfCommons(3,12);
    let opts = {
        game:tgame,
        player:1,
        gamescreen_element:document.querySelector('section.cows-game'),
        situation: new Map([ [1,new Set()], [2,new Set(['f2','f3'])], [3,new Set(['f4','f5','f6'])] ])
    }
    let videogame = new VideoGame(opts);
    videogame.drawChoices();
  });

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

class TragedyOfCommons{
    constructor(n,A){
        this.players = Array.from({length: n}, (_, i) => i + 1);
        this.A = A;
        this.actions = new Map( this.players.map( p => [p, 0] ) );
        }

    setAction(player, a){
        this.actions.set(player,a);
        }

    getPayoff(player){
        let sum = 0;
        this.actions.forEach( (v,k) => sum += v );
        return this.actions.get(player) * (this.A - sum);
    }
}

class VideoGame {
    constructor({game, player, gamescreen_element, situation}){
        this.game = game;
        this.player = player;
        if( typeof situation === "undefined" ){
            this.situation = new Map();
            for( const p of game.players ){
                this.situation.add(p,new Set());
                };
            }
        else{ this.situation = situation; }
        this.screen = gamescreen_element;
        }
    addChoice(player,choice){
        return this.situation[player].add(choice);
        }
    removeChoice(player,choice){
        return this.situation[player].delete(choice);
        }
    
    drawChoices(){
        for( const [player,strategy] of this.situation ){
            for( const id of strategy ){
                let field = this.screen.querySelector('#'+id);
                field.appendChild( this.createCard(player) );
                }
            }
        }

    getPayoff(){
        let p = this.situation[this.player].size;
        this.game.setAction(this.player);
        return this.game.getPayoff(this.player);
        }
    
    sendChoice(){

    }

    createCard(player){
        var card = document.createElement("img");
        card.classList.add('cow', 'player-'+player);
        card.setAttribute('src',"../img/cow.png");
        return card;
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

function place_a_cow (cow_action,field_element) {
    
    cow_action.card.style.left = 0 + 'px';
    cow_action.card.setAttribute('graze',true);
    field_element.removeEventListener('drop',drop);
    field_element.removeEventListener('dragover',allowDrop);
    player_state.game_calculator.addChoice( cow_action.player, field_element.id );
    }