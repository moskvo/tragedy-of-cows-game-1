module.exports.n = 3; // число игроков
module.exports.fieldsize = 12; // размер поля

module.exports.statsport = '8080'; // порт, на котором открывается WebSocket
module.exports.port = '8081'; // порт, на котором открывается WebSocket
module.exports.adminport = '8082'; // порт, на котором открывается WebSocket для администрирования
module.exports.updateinterval = 2000; // интервал обновления клиентов (в мс)
module.exports.historydepth = 100; // глубина истории
module.exports.sleeptime = 5000; // частота смены стратегии
module.exports.expdecay = 0.9; // вес истории при экспоненциальном сглаживаниии выигрышей
module.exports.trace = 0.5; // вес истории при экспоненциальном сглаживаниии траекторий

module.exports.singleuser = false; // разрешать только одну сессию с одного IP  

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
    
    getPayoffs(){
        let sum = 0;
        this.actions.forEach( (v,k) => sum += v );
        return this.actions.get(player) * (this.A - sum);

        }

    to_string(){
        return `game is (players=${this.players}, fields=${this.A}, actions=${[...this.actions.entries()]}`;
        }
    }

module.exports.TheGame = TragedyOfCommons;

class Group {
    constructor(gameapi,players_ids) {
        this.game = gameapi.new_game(players_ids.length);
        this.players_ids = players_ids;
        this.ids_players_map = new Map(this.game.players.map( (e,i)=> [players_ids[i], e] ));
        this.situation = this.empty_situation();
        this.round = 0;

        this.choices_done = false;
        this.players_with_choices = [];        
        }
    
    empty_situation() {
        return new Map(this.game.players.map( el => [el,[]]) );
        }

    fixChoice(player_id, a) {
        if( ! this.ids_players_map.has(player_id) )
            { return false; }
        let current_player = this.ids_players_map.get(player_id);
        this.situation.set(current_player,a);

        this.game.setAction(current_player,a.length);
        
        this.players_with_choices.push(player_id);
        if( this.players_with_choices.length == this.players_ids.length ) 
            { this.choices_done = true; }
        }
    
    // return map id=>payoff
    async get_payoffs(){
        let m = new Map();
        for( let [k,v] of this.ids_players_map ){
            m.set( v, this.game.getPayoff(v) );
            }
        return m;
        }

    next_round(){
        this.choices_done = false;
        this.players_with_choices = [];
        }
    }

module.exports.Group = Group;
