'use strict';

if (!window.WebSocket) {
	document.body.innerHTML = 'WebSocket в этом браузере не поддерживается.';
}

// создать подключение
var socket = new WebSocket('ws://'+IP+':'+port);

socket.onopen = function(e) {
    console.log("[open] Соединение установлено");
  };

class TragedyOfCommons {
    constructor(n,A) {
        this.players = Array.from({length: n}, (_, i) => i + 1);
        this.A = A;
        this.actions = new Map( this.players.map( p => [p, 0] ) );
        }
    
    get n(){
        return this.players.length;
        }

    setAction(player, a) {
        this.actions.set(player,a);
        }

    getPayoff(player){
        let sum = 0;
        this.actions.forEach( (v,k) => sum += v );
        return this.actions.get(player) * (this.A - sum);
        }
    to_string(){
        return `game is (players=${this.players}, fields=${this.A}, actions=${[...this.actions.entries()]}`;
        }
    }

class VideoGame {
    constructor({game, player, gamescreen_element, situation}){
        this.game = game;
        this.player = player;
        this.setSituation(situation);
        this.screen = gamescreen_element;

        let self = this;

        this.screen.querySelectorAll('.droppable').forEach((v)=>{
            v.addEventListener('drop',drop);
            v.addEventListener('dragover',allowDrop);
            })
        
        this.cows = this.screen.querySelectorAll('.cow');
        this.cows_conf = new Map();
        this.cows.forEach( (v,i) => {
            v.addEventListener('dragstart',dragstart);
            v.setAttribute('draggable', true);
            v.classList.add('player-'+self.player);
            v.style.left = i*50 + 'px';
            self.cows_conf.set(v.id,{left:i*50 + 'px'})
            });
        
        self.fields = document.querySelectorAll('.game-field');
        self.choice_set = document.querySelector('.choice-set');
        self.payoff_element = document.getElementById('payoff');
        this.drawPayoff();
        }
    addChoice(choice,player){
        let c = this.situation.get(player);
        c.push(choice);
        this.game.setAction(player,c.length);
        //this.payoff_element.textContent = this.getPayoff();
        }
    removeChoices(choices,player){
        let c = this.situation.get(player).filter(e=>(!choices.includes(e)));
        this.situation.set(player,c);
        this.game.setAction(player,c.length);
        //this.payoff_element.textContent = this.getPayoff();
        }
        
    wipeCards(){
        for( const [player,strategy] of this.situation ){
            for( const f_id of strategy ){
                let field = document.getElementById(f_id);
                let cow = field.querySelector('img.cow');
                this.upCard(cow,field);
                if( player == this.player ){
                    this.placeCard(cow,this.choice_set);
                    }
                else {
                    cow.remove();
                    }
                }
            }
        this.removeChoices(Array.from(strategy),this.player);
        }    
    
    async drawCards(){
        console.log('drawChoices')
        for( const [player,strategy] of this.situation ){
            let draggable = (player == this.player);
            for( const id of strategy ){
                let field = this.screen.querySelector('#'+id);
                this.placeCard( this.createCard(player,draggable), field, player); //field.appendChild( this.createCard(player,draggable) );
                }
            }
        }

    async drawPayoff(){
        this.payoff_element.textContent = this.getPayoff();
    }


    getPayoff(){
        console.log( this.game.to_string() );
        console.log( [...this.situation]);
        return this.game.getPayoff(this.player);
        }
    
    sendChoice() {
        var outgoingMessage = JSON.stringify({choice:this.situation.get(this.player)});
        socket.send(outgoingMessage);   
        }
    async setSituation(situation) {
        this.situation = situation || new Map(game.players.map(p=>[p,[]])) ;
        for( const [p,v] of this.situation ){
            this.game.setAction(p,v.length);
            }
        }

    createCard(player, draggable=true) {
        var card = document.createElement("img");
        card.classList.add('cow', 'player-'+player);
        card.setAttribute('src',"img/cow.png");
        card.setAttribute('draggable',draggable);
        return card;
        }
    
    placeCard(card,newplace,player=this.player) {
        if( newplace.classList.contains('choice-set') ){
            card.style.left = this.cows_conf.get(card.id).left;
            card.removeAttribute('graze');
            }
        else { 
            card.style.left = 0 + 'px';
            card.setAttribute('graze',true);
            newplace.removeEventListener('drop',drop);
            newplace.removeEventListener('dragover',allowDrop);
            //this.addChoice(player, newplace.id);
            }
        newplace.appendChild(card);
        }
    
    upCard(card,oldplace,player=this.player) {
        //card.parentNode.removeChild(card);
        if ( oldplace.classList.contains('game-field') ) {
            oldplace.addEventListener('drop',drop);
            oldplace.addEventListener('dragover',allowDrop);
            //this.removeChoices([oldplace.id],player);
            }  
        }
    
    } // class VideoGame


let videogame;

document.addEventListener("DOMContentLoaded", function(event) {
    let tgame = new TragedyOfCommons(n,fieldsize);
    let opts = {
        game:tgame,
        player:1,
        gamescreen_element:document.querySelector('section.cows-game'),
        situation: new Map([ [1,[]], [2,['f2','f3']], [3,['f4','f5','f6']] ])
        }
    videogame = new VideoGame(opts);
    videogame.drawCards();
    videogame.drawPayoff();

    let blind = document.getElementById("blind");

    let btn = document.getElementById("send");
    btn.onclick = function() { blind.style.visibility = 'visible'; };

    });

const interface_state = {
    draggable: null
    };

function drop(event) {
    event.preventDefault();
    //let card_id = ev.dataTransfer.getData("text");
    let card = interface_state.draggable;// document.getElementById(card_id);
    let oldplace = card.closest('.droppable');
    videogame.upCard( card,oldplace );
    videogame.removeChoices([oldplace.id],videogame.player);
    // взять элемент на данных координатах
    //let elem = document.elementFromPoint(ev.clientX, ev.clientY);
    // найти ближайший сверху droppable
    let newplace = event.target.closest('.droppable');
    if( newplace === null ) { console.dir(event); }
    videogame.placeCard( card,newplace );
    videogame.addChoice( newplace.id, videogame.player );
    videogame.drawPayoff();

    //ev.target.appendChild(document.getElementById(data));
    }

function allowDrop(ev) { ev.preventDefault(); }

function dragstart(ev) {
    ev.dataTransfer.setData("text", ev.target.id);
    interface_state.draggable = ev.target;
    }


// обработчик входящих сообщений
socket.onmessage = function(event) {
    var incomingMessage = JSON.parse(event.data);
    if(incomingMessage.newround) {
        videogame.situation = incomingMessage.situation;
        videogame.drawChoices();
        }    
    if(incomingMessage.HTML){
        document.getElementById("blind").innerHTML = incomingMessage.HTML;
    }
    if(incomingMessage.showcontrols) {
        document.getElementById("blind").style.visibility = 'hidden';
        }
    else {
        document.getElementById("blind").style.visibility = 'visible';
        }
  };
  
  // обработчик обрыва сокета - реконнект
  socket.onclose = function(event) {
      // перезагрузить страницу при обрыве связи
      console.log('socket close, event:'+JSON.stringify(event));
      //location.reload(true);
  };
  