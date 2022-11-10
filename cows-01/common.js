class TragedyOfCommons {
    constructor(n,A) {
        this.players = Array.from({length: n}, (_, i) => i + 1);
        this.A = A;
        this.actions = new Map( this.players.map( p => [p, 0] ) );
        this.payoffs = new Map( this.players.map( p => [p, 0] ) );
        this.payoff_actual = false;
        }
    
    get n(){ return this.players.length; }

    setAction(player, a) { 
        this.actions.set(player,a); 
        this.payoff_actual = false; 
        }

    getPayoff(player){
        if( ! this.payoff_actual )
            this.calcPayoffs();
        return this.payoffs.get(player);
        }
    calcPayoffs(){
        let sum = 0;
        this.actions.forEach( (v,k) => sum += v );
        for( let p of this.players ){
            this.payoffs.set(p, this.actions.get(p) * (this.A - sum) );
            }
        }
    to_string(){
        return `game is (players=${this.players}, fields=${this.A}, actions=${[...this.actions]}`;
        }
    }

class VideoGame {
    constructor({game, player, gamescreen_element, situation}){
        let self = this;
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

        // create blind
        // create info & button
        // create choice-set
        this.baseElements();

        // create cowcards and their place - 'choice sets'
        this.choice_set = this.screen.querySelector('div.choice-set');
        this.choice_sets = {};
        let cows_per_player = this.game.n == 3 ? 9 : 20
        //let cow_width = this.screen.style.getPropertyValue()
        this.cows_conf = new Map(); // conf of cowcards positions, changing by createChoiceSet
        for( let p of this.players ) {
            this.choice_sets[p] = this.choice_set.appendChild(
                    this.createChoiceSet(p, cows_per_player) 
                    )
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
                self.screen.appendChild(self.createField('grass','f'+(3+i)))
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
            v.addEventListener('drop',self);
            v.addEventListener('dragover',self);
            })
        
        this.cows = this.screen.querySelectorAll('.cow');        
        this.fields = this.screen.querySelectorAll('.game-field');

        this.payoff_elements = 
            this.players.map( p => 
                this.screen.querySelector(`span[payoff-${p}]`) );
        this.blind = this.screen.querySelector('.blind');
        this.dragged = null;
        this.drawPayoff();
        }

    setPlayer(player){ // legacy - all cows will be of player!
        this.cows.forEach( (v,i) => {
            v.classList.replace('player-'+this.player,'player-'+player);
            });
        this.player = player;
        }

    addChoice(choice,player){
        let c = this.situation.get(player);
        c.push(choice);
        this.game.setAction(player,c.length);
        }
    removeChoices(choices,player){
        let c = this.situation.get(player).filter(e=>(!choices.includes(e)));
        this.situation.set(player,c);
        this.game.setAction(player,c.length);
        }
        
    async wipeCards(){
        for( const [gamer,strategy] of this.situation ){
            let move = this.players.includes(gamer);
            for( const f_id of strategy ){
                let field = this.screen.querySelector('#'+f_id);
                let cow = field.querySelector('img.cow');
                this.upCard(cow,field);
                if( move ){
                    this.placeCard(cow,this.choice_sets[gamer],gamer);
                    }
                else {
                    cow.remove();
                    }
                }
            //this.removeChoices(Array.from(strategy),gamer);
            }
        //this.drawPayoff();
        }    
    
    async drawCards(){
        await this.wipeCards(); // to avoid multiple cards on some field
        for( const [gamer,strategy] of this.situation ){
            let move = this.players.includes(gamer);
            for( const id of strategy ){
                let field = this.screen.querySelector('#'+id);
                let card = move ? 
                            this.giveLastCard(gamer) : this.createCard(gamer,false);
                this.placeCard( card, field, gamer); //field.appendChild( this.createCard(player,draggable) );
                }
            }
        }

    async drawPayoff(){
        for( let p in this.players )
            this.payoff_elements[p].textContent = this.getPayoff(this.players[p]);
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


    getPayoff(gamer){
        console.log( this.game.to_string() );
        console.log( [...this.situation]);
        return this.game.getPayoff(gamer);
        }
            
    setSituation(situation) {
        this.situation = situation || new Map(this.game.players.map(p=>[p,[]])) ;
        for( const [p,v] of this.situation ){
            this.game.setAction(p,v.length);
            }
        return this;
        }

    createField(grass, id=null) {
        var field = createl("div",null,["game-field"]);
        if( grass == 'grass' )
            field.classList.add('grass-field', 'droppable');
        else
            field.classList.add('ground-field');
        if ( id ) field.id = id;
        return field;
        }
    createCard(player, draggable=true, id=null) {
        var card = createl("img",null,['cow', 'player-'+player]);
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
            newplace.removeEventListener('drop',this);
            newplace.removeEventListener('dragover',this);
            //this.addChoice(player, newplace.id);
            }
        newplace.appendChild(card);
        }
    
    upCard(card,oldplace,player=this.player) {
        //card.parentNode.removeChild(card);
        if ( oldplace.classList.contains('game-field') ) {
            oldplace.addEventListener('drop',this);
            oldplace.addEventListener('dragover',this);
            //this.removeChoices([oldplace.id],player);
            }  
        }
    
    createChoiceSet(forplayer, cows_per_player=9){
        let chset = createl("div",null,['choice-set-'+forplayer, 'droppable']);
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

            cow.addEventListener('dragstart',this);
            }
        return chset
        }

    handleEvent(event) {
        switch(event.type) {
            case 'drop':
                this.drop(event);
                break;
            case 'dragover':
                this.allowDrop(event);
                break;
            case 'dragstart':
                this.dragstart(event);
                break;
            }
        }
    
    drop(event) {
        event.preventDefault();
        //let card_id = ev.dataTransfer.getData("text");
        let card = this.dragged;// document.getElementById(card_id);
        let oldplace = card.closest('.droppable');
        let player = parseInt(card.getAttribute('player'));
        this.upCard( card,oldplace );
        this.removeChoices([oldplace.id],player);
        // взять элемент на данных координатах
        //let elem = document.elementFromPoint(ev.clientX, ev.clientY);
        // найти ближайший сверху droppable
        let newplace = event.target.closest('.droppable');
        if( newplace === null ) { console.dir(event); }
        this.placeCard( card, newplace, player );
        if( ! newplace.classList.contains('choice-set-'+player) ) {
            this.addChoice( newplace.id, player );
            }
        this.drawPayoff();
    
        //ev.target.appendChild(document.getElementById(data));
        }
    
    allowDrop(ev) { ev.preventDefault(); }
    
    dragstart(ev) {
        ev.dataTransfer.setData("text", ev.target.id);
        this.dragged = ev.target;
        }

    baseElements(){
        function payoff_str(p1,...pls){
            if( !p1 && pls.length == 0 )
                [p1,pls] = [1,[2,3]];
            let s = `<p>Прибыль игрока ${p1}:  <span payoff-${p1}>0</span></p>`
            for( let p of pls)
                s += `<p>Прибыль игрока ${p}:  <span payoff-${p}>0</span></p>`
            return s;
            }
        
        this.screen.appendChild( 
            createl('div', null, ["blind"],
                createl('div', "<h2>Ожидание подключения еще</h2>", ["blind-text"])
            ));
        
        this.screen.appendChild( 
            createl('div', null, ["info"],
                createl('div', payoff_str(...this.players), ["text-info"]),
                createl('div',
                        '<button id="send" class="btn danger">ОТПРАВИТЬ КОРОВ</button>',
                        ["text-info"])
            ));

        this.screen.appendChild( createl('div', null, ["choice-set"]) );
        }
    
    static createGameElement(id){
        let e = document.createElement("div");
        e.id = 'game-' + id;
        e.classList.add('cows-game')
        return e;
        }

    } // class VideoGame

function createl(tag,inhtml, cssclasses,...childs) {
    let e = document.createElement(tag);
    e.classList.add(...cssclasses)
    if( inhtml ) e.innerHTML = inhtml
    for( let c of childs ){ e.appendChild(c) }
    return e
    }
