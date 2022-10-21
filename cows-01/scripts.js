'use strict';

if (!window.WebSocket) {
	document.body.innerHTML = 'WebSocket в этом браузере не поддерживается.';
    }

// создать подключение
var socket;
function sendChoice(choice) {
    socket.send(JSON.stringify({choice}));
    }

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
        return `game is (players=${this.players}, fields=${this.A}, actions=${[...this.actions]}`;
        }
    }

class VideoGame {
    constructor({game, player, gamescreen_element, situation}){
        this.game = game;
        if( Array.isArray(player) ) {
            this.players = player
            this.player = player[0]
            }
        else {
            this.players = [player];
            this.player = player;
            } 
        this.setSituation(situation);
        this.screen = gamescreen_element;

        // create cowcards and their place - 'choice sets'
        this.choice_set = this.screen.querySelector('div.choice-set');
        this.choice_sets = {};
        let cows_per_player = this.game.n == 3 ? 9 : 20
        //let cow_width = this.screen.style.getPropertyValue()
        this.cows_conf = new Map(); // conf of cowcards positions, changing by createChoiceSet
        for( let p of this.players ){
            let c = this.createChoiceSet(p, cows_per_player)
            this.choice_set.appendChild( c )
            this.choice_sets[p] = c
            }
        // create fields
        if( game.n == 5 ){
            this.screen.style.setProperty('--columns-number', 6);
            this.screen.style.setProperty('--rows-number', 5);
            
            for( let i = 0, id = 1 ; i < 5 ; i++ ) {
                for( let j = 0 ; j < 6 ; j++ ) {
                    this.screen.appendChild(this.createField('grass','f'+id))
                       id++
                    }
                }
            }
        else if( game.n == 3 ) {
            this.screen.style.setProperty('--columns-number', 4);
            this.screen.style.setProperty('--rows-number', 4);

            this.screen.appendChild(this.createField('ground'))
            this.screen.appendChild(this.createField('grass','f1'))
            this.screen.appendChild(this.createField('grass','f2'))
            this.screen.appendChild(this.createField('ground'))

            // fields f3-f10
            Array.from({length: 8}, (_, i) => 
                this.screen.appendChild(this.createField('grass','f'+(3+i)))
                )

            this.screen.appendChild(this.createField('ground'))
            this.screen.appendChild(this.createField('grass','f11'))
            this.screen.appendChild(this.createField('grass','f12'))
            this.screen.appendChild(this.createField('ground'))
            }
        else {
            alert('wrong players count! Not 3 or 5')
            }
        
        this.screen.querySelectorAll('.droppable').forEach((v)=>{
            v.addEventListener('drop',drop);
            v.addEventListener('dragover',allowDrop);
            })
        
        this.cows = this.screen.querySelectorAll('.cow');        
        this.fields = this.screen.querySelectorAll('.game-field');
        this.payoff_element = this.screen.querySelector('#payoff');
        this.drawPayoff();
        }

    setPlayer(player){
        this.cows.forEach( (v,i) => {
            v.classList.replace('player-'+this.player,'player-'+player);
            });
        this.player = player;
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
                let field = this.screen.querySelector('#'+f_id);
                let cow = field.querySelector('img.cow');
                this.upCard(cow,field);
                if( this.players.includes(player) ){
                    this.placeCard(cow,this.choice_sets[player]);
                    }
                else {
                    cow.remove();
                    }
                }
            this.removeChoices(Array.from(strategy),this.player);
            }
        }    
    
    async drawCards(){
        console.log('drawChoices');
        for( const [player,strategy] of this.situation ){
            for( const id of strategy ){
                let field = this.screen.querySelector('#'+id);
                let card = (player == this.player) ? 
                            this.giveLastCard(player) : this.createCard(player,false);
                this.placeCard( card, field, player); //field.appendChild( this.createCard(player,draggable) );
                }
            }
        }

    async drawPayoff(){
        this.payoff_element.textContent = this.getPayoff();
        }

    giveLastCard(player){
        let lastcard, cards = this.choice_sets[player].querySelectorAll('img.cow');
        let maxid = 0;
        for( let c of cards ) {
            let ord = parseInt(c.getAttribute('myorder'))
            if( maxid < ord ) {
                lastcard = c;
                maxid = ord;
                }
            }
        return lastcard;
        }


    getPayoff(){
        console.log( this.game.to_string() );
        console.log( [...this.situation]);
        return this.game.getPayoff(this.player);
        }
            
    async setSituation(situation) {
        this.situation = situation || new Map(this.game.players.map(p=>[p,[]])) ;
        for( const [p,v] of this.situation ){
            this.game.setAction(p,v.length);
            }
        }

    createField(grass, id=null) {
        var field = document.createElement("div");
        if( grass == 'grass' )
            field.classList.add('game-field', 'grass-field', 'droppable');
        else
            field.classList.add('game-field', 'ground-field');
        if ( id ) field.id = id;
        return field;
        }
    createCard(player, draggable=true, id=null) {
        var card = document.createElement("img");
        card.classList.add('cow', 'player-'+player);
        card.setAttribute('src',"img/cow.png");
        card.setAttribute('draggable',draggable);
        card.setAttribute('player',player)
        if ( id ) card.id = id;
        return card;
        }
    
    placeCard(card,newplace,player) {
        if( newplace.classList.contains('choice-set-'+player) ){
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
    
    createChoiceSet(forplayer, cows_per_player=9){
        let chset = document.createElement("div")
        chset.classList.add('choice-set-'+forplayer, 'droppable')
        chset.style.width = (100/this.players.length)+'%';
        let cs = getComputedStyle(this.screen)
        let cowwidth = parseInt(cs.getPropertyValue('--game-width'))
                 / parseInt(cs.getPropertyValue('--columns-number')) - 10 ;
        let dw = cs.getPropertyValue('--game-width')
        dw = ((parseInt(dw) / this.players.length) - cowwidth) / cows_per_player;
        for( let i=0, cow ; i < cows_per_player ; i++ ){
            //<img id="img1" class="cow" src="img/cow.png" alt="Cow card" />
            cow = this.createCard(forplayer)
            cow.id = 'img'+forplayer+'-'+(i+1)
            cow.setAttribute('myorder',i)
            chset.appendChild(cow)
            cow.style.left = i*dw + 'px';
            this.cows_conf.set(cow.id,{left:i*dw + 'px'})

            cow.addEventListener('dragstart',dragstart);
            }
        return chset
        }
    
    } // class VideoGame


let videogame;

document.addEventListener("DOMContentLoaded", function(event) {
    let fieldsize = (n==3) ? 12 : 30;
    let tgame = new TragedyOfCommons(n,fieldsize);
    let opts = {
        game:tgame,
        player:[1,2],
        gamescreen_element:document.querySelector('section.cows-game'),
        //situation: new Map([ [1,[]], [2,['f2','f3']], [3,['f4','f5','f6']] ])
        }
    videogame = new VideoGame(opts);

    videogame.blind = document.getElementById("blind");

    let btn = document.getElementById("send");
    btn.onclick = function() {
        videogame.blind.style.visibility = 'visible';
        sendChoice( videogame.situation.get(videogame.player) );
        };
    
    socket = new WebSocket('ws://'+IP+':'+port);
    socket.onopen = (e) => console.log("[open] Соединение установлено")
    // обработчик входящих сообщений
    socket.onmessage = function(event) {
        var incomingMessage = JSON.parse(event.data);
        console.log( incomingMessage );
        if(incomingMessage.HTML){
            videogame.blind.innerHTML = incomingMessage.HTML;
            videogame.blind.style.visibility = incomingMessage.showcontrols?'hidden':'visible';
            return;
            }
        if( incomingMessage.playertype ){
            videogame.setPlayer(incomingMessage.playertype);
            return;
            }
        if( incomingMessage.newround ) {
            videogame.wipeCards();
            videogame.blind.style.visibility = 'hidden';
            videogame.setSituation(new Map(incomingMessage.situation));
            videogame.drawCards();
            videogame.drawPayoff();
            return;
            } 
        };
    
    // обработчик обрыва сокета - реконнект
    socket.onclose = function(event) {
        // перезагрузить страницу при обрыве связи
        console.log('socket close, event:'+JSON.stringify(event));
        //location.reload(true);
        };
    
    });

const interface_state = {
    draggable: null
    };

function drop(event) {
    event.preventDefault();
    //let card_id = ev.dataTransfer.getData("text");
    let card = interface_state.draggable;// document.getElementById(card_id);
    let oldplace = card.closest('.droppable');
    let player = parseInt(card.getAttribute('player'));
    videogame.upCard( card,oldplace );
    videogame.removeChoices([oldplace.id],player);
    // взять элемент на данных координатах
    //let elem = document.elementFromPoint(ev.clientX, ev.clientY);
    // найти ближайший сверху droppable
    let newplace = event.target.closest('.droppable');
    if( newplace === null ) { console.dir(event); }
    videogame.placeCard( card, newplace, player );
    if( ! newplace.classList.contains('choice-set-'+player) ) {
        videogame.addChoice( newplace.id, player );
        }
    videogame.drawPayoff();

    //ev.target.appendChild(document.getElementById(data));
    }

function allowDrop(ev) { ev.preventDefault(); }

function dragstart(ev) {
    ev.dataTransfer.setData("text", ev.target.id);
    interface_state.draggable = ev.target;
    }