'use strict';

var http = require('http'); 
var Static = require('node-static');

var parameters = require("./cowsparameters");
var size = parameters.fieldsize;
let gameapi = {
    new_game: () => new parameters.TheGame(n,size)
};

console.log('FIELD SIZE = '+String(size));

var WebSocketServer = new require('ws');

// глобальные переменные:
// подключенные клиенты
var players = {};
// их оппоненты
var opponents = {};
// стратегии игроков
var strategies = {};
// история выигрышей
var history = {}; 
// накопленный выигрыш
var payoffs = {}; 
// текущий рекорд накопленного выигрыша
var record = 0; 
// перемешивать игроков каждый период
var shuffleflag = false;

var groups = [];
var player_in_group = {};

class Group {
    constructor(gameapi,players_ids) {
        this.game = gameapi.new_game(players_ids.length);
        this.players_ids = players_ids;
        this.players_map = this.game.players.map( (e,i)=> [players_ids[i], e] );

        this.choices_done = false;
        this.players_with_choices = [];        
        }

    fixChoice(player, a) {
        this.game.setAction(player,a);
        this.players_with_choices.push(player);
        if( this.players_with_choices.length == this.players.length ) { this.choices_done = true; }
        }
    
    get payoffs(){
        let m = new Map();
        for( let [k,v] of this.players_map.entries() ){
            m.set( k, this.game.getPayoff(v) );
            }
        return m;
        }

    next_round(){
        this.choices_done = false;
        this.players_with_choices = [];
        }
    }



var clients = []; // переменная, которая хранит ID сессий при комплектовании игроками игры 
var clients_sockets = {} // переменная, которая хранит ссылку на сокет при комплектовании игроками игры
// при этом история выигрышей сессии никогда не очищается, и, потому, сохраняется 

// старутем WebSocket-сервер на порту, определяемом параметрами в файле
var webSocketServer = new WebSocketServer.Server({port: parameters.port});

webSocketServer.on('connection', function(ws,req) { // запускается, когда новый клиент присоединяется к серверу
    if ( parameters.singleuser ) {
        var id = req.socket.remoteAddress; // ID новой сессии - ip !менял connection на socket
        }
    else {
        var id = Math.random().toString()+req.socket.remoteAddress; // ID новой сессии - float от 0 до 1
        }
    clearHistory(id); // обнулить историю. при этом история выигрышей сессии никогда не очищается, и, потому, сохраняется 
    
    if ( players[id] != undefined || clients_sockets[id] != undefined ) { // запретить сессии с одинаковым ID
        ws.send(JSON.stringify({HTML: "<h1>Одному игроку запрещено запускать несколько игровых сессий!</h1>"}));
        console.log("дублирующая сессия, ID = "+id);
        //ws.close();
        return false;
        }
    console.log("новая сессия, ID = "+id);

    addSessionToWaitingList(id, ws);
    
    // Обработчики событий 
    ws.on('message', function(message) { // игроки присылают на сервер свои стратегии в сообщениях
        console.log('получено сообщение ' + message);
        var x = JSON.parse(message); // предполагается, что стратегия передается в JSON 
        if( x.action ){
            strategies[id] = x;
            }
        });
    
    ws.on('close', function() { // обработка закрытия сессии
        if (clients_sockets[id] != null) { // если сессия закрылась на этапе ожидания
            console.log('гасим ожидающую сессию id=' +id);
            delete clients_sockets[id]; // вычистить клиента из массива ожидающих сессий            
            var index = clients.indexOf(id);
            if (index > -1) {
               clients.splice(index, 1);
            }// вычистить из списка оппонентов

        } else { // при закрытии играющей сессии принудительно ставятся в очередь сессии и всех оппонентов
            console.log('гасим играющую сессию id=' +id);
            var ops = opponents[id].players; // получить список ID всех оппонентов

            for(let i in ops) { // сессии всех остальных оппонентов в таблицу ожидания
                if( ops[i] != id && players[ops[i]] != null) {
                    addSessionToWaitingList(ops[i], players[ops[i]]); // поместить оппонентов в ожидающие сессии
                    }
                }
            delete players[id]; // вычистить выбывшего игрока из массива играющих сессий
            delete opponents[id]; // вычистить его из оппонентов
            delete strategies[id]; // вычистить его из стратегий
        }
    });

}); // end websoket events definition

function addSessionToWaitingList(player_id, wws) { // инлайновая функция
    players[player_id] = undefined; // вычистить (на всякий случай) из массива играющих сессий
    opponents[player_id] = undefined; // вычистить (на всякий случай) из оппонентов
    strategies[player_id] = undefined; // вычистить (на всякий случай) из стратегий

    clients.push(player_id); // добавить новую сессию в список игроков
    clients_sockets[player_id] = wws; // добавить ссылку на сокет в список игроков
    
    if(clients.length == parameters.n) { // если набрался полный комплект участников 
        let g = new Group(gameapi,clients);
        groups.push(g);
        for (let i of clients) {
            players[i] = clients_sockets[i]; // поместить игрока в таблицу 
            console.log('поместить в таблицу играющих ID='+i);
            opponents[i] = {players:clients};  // а также запомнить его оппонентов
            player_in_group[i] = g;
            strategies[i] = [];         // инициализировать начальное значение стратегии (зависит от игры!!!)
        }
        clients = []; // готов формировать новый комплекс игроков
        clients_sockets = {};
    }
}


// Посылать информацию о подключении каждые updateinterval милисекунд
setInterval(connectInfo, parameters.updateinterval);

// Обновлять игровые поля каждые updateinterval милисекунд
setInterval(sendFields, parameters.updateinterval);

function connectInfo()
    {
        for(var soc in clients_sockets) { // по всем клиентам, ожидающим подключения
            if (clients_sockets[soc]!=undefined) {
                var message={};
                message.HTML ='<p><h2>Ожидание подключения еще '+ (parameters.n-clients.length)+ ' игроков для начала игры...</h2></p>';
                message.HTML += drawStats(soc);
                message.showcontrols=false;
                clients_sockets[soc].send(JSON.stringify(message));
            }
        }
    }

        // это основная функция, которую необходимо модифицировать от игры к игре
        // она вычисляет выигрыши всех игроков, рисует поле в html и отправляет его для отображения клиенту
        
function sendFields() {        
    var fieldHTML; //  поле для текущего игрока
    var historyHTML; //  график истории выигрыша для сессии key
    var statsHTML; //  таблица со статистикой для сессии key
    var message={};

    var message={};
    for(var key in players) {
        if (players[key]!=undefined) {
            if(gamepause) {
                fieldHTML = '<p style="color:red; font-size:xx-large">ИГРА ПРИОСТАНОВЛЕНА! ВНИМАНИЕ НА ЛЕКТОРА!</p>'; //  поле для текущего игрока
                message.showcontrols=false; // заблокировать ввод стратегий в режиме паузы
                } 
            else {
                var s = getStrategies(key); // вычислить профиль стратегий

                // вычислить выигрыш, текущий игрок всегда считается первым
                var f = getPayoff(1, s);

                // заполнить историю выигрышей
                history[key].shift();
                history[key].push(f);            

                fieldHTML = drawField(1, s); // нарисовать поле для текущего игрока
                message.showcontrols=true;
                }
            historyHTML = drawHistory(key); // нарисовать график истории выигрыша для сессии key
            statsHTML = drawStats(key); // вывести таблицу со статистикой для сессии key
            message.HTML = '<p>'+fieldHTML+historyHTML+statsHTML+'</p>';
            players[key].send(JSON.stringify(message)); // отправить сформированный HTML клиенту
        }
    }
    if(!gamepause) { // выигрыши обновляются только если не в режиме паузы
        record = 0; // мы смотрим только рекорды живых сессий
        for(var key in players) { // обновить накопленные выигрыши
            if (players[key]!=undefined) {
                if (history[key].slice(-1)[0] != null) {
                    if (payoffs[key]!=undefined) {
                        payoffs[key]=lambda*payoffs[key]+(1-lambda)*history[key].slice(-1)[0];
                    } else {
                        payoffs[key]=history[key].slice(-1)[0];
                    }
                            
                } else {
                    payoffs[key]=0;
                }
                if (payoffs[key]>record) {
                    record = payoffs[key];
                }
            }
        }

        if(shuffleflag) { // если режим перемешивания, то для следующего периода перемешать игроков
            shufflePlayers();
        }
    }
}

function getStrategies(key) {
    var ops=opponents[key].players; // для Коров на поле, игроков двое 
    var s = {};
    s.x = strategies[key];
    
    
    for(let i=0;i<ops.length;i++) { // получить стратегию оппонента
        if(ops[i] != key) {
            s.y=strategies[ops[i]];
        }
    }
    return s;
}

// вычислить выигрыш игрока player при профиле стратегий s
function getPayoff(player, s) {
    return Math.max(0,(size*size-s.x-s.y)*s.x);        
}

// нарисовать поле для игрока player при стратегиях s
function drawField(player, s) {
    var message='<style> table {} .tbl-field {border-collapse: collapse; align:center;}</style><style> td {} .td-field {border: 1px solid green;} </style>';
    message+='<table class=tbl-field>';
    for (let i = 0; i < size; i++) {
        message+='<tr>';
        for (let j = 0; j < size; j++) {
            message+='<td class=td-field width=50 height=50 bgcolor="green" background="grass.gif">';
            if(i*size+j+1<=s.x) {
                message+='<img width=50 src=cow1.gif alt="1">';
            }
            else if(size*size-(i*size+j+1)<s.y) {
            message+='<img width=50 src=cow2.gif alt="2">';
            }
            message+='</td>';
        }
        message+='</tr>';
    }
    message+='</table>';

    return message;
}

// обычный сервер (статика) на порту 8080
//var fileServer = new Static.Server('.');
//http.createServer(function (req, res) {
//  
//  fileServer.serve(req, res);
//
//}).listen(8080);

// старутем WebSocket-сервер на порту, определяемом параметрами в файле
var adminServer = new WebSocketServer.Server({port: parameters.adminport});

adminServer.on('connection', function(ws) { // запускается, когда админ присоединяется к серверу
    console.log('новая админская сессия');
    var verified = false;
                
    // Обработчики событий 
    ws.on('message', function(message) { // админ присылает на сервер пароль и команды обнуления статистики
        console.log('получено админское сообщение');
        var command = JSON.parse(message); // предполагается, что команда передается в JSON 
        if(command.hasOwnProperty('password') && command.password==='trapeznikov') { // если передан пароль, причем правильный
            verified = true;
            if(command.hasOwnProperty('restart')) { // если запрошен рестарт статистики
                console.log('запрошен рестарт');
                restartStats();
            }
            if(command.hasOwnProperty('shuffle')) { // если запрошено перемешать игроков
                shuffleflag = command.shuffle;
                console.log('перемешивать игроков = ' + shuffleflag.toString());
            }
        } else { 
            verified = false;
        }
        
    });
    
    ws.on('close', function() { // обработка закрытия сессии
        console.log('закрывается админская сессия');        
    });

    
    // Посылать информацию об игре админу каждые updateinterval милисекунд
    setInterval(sendAdmin, parameters.updateinterval);
    
    let rho = Array(size*size+1).fill().map(() => Array(size*size+1).fill(0)); // плотность распределения стратегий

    function sendAdmin() {
        if(verified === false) { // отображать только авторизованным админам
            return;
        }
        var maxrho = 0; // maximum density value for color normalization 
        var f;
        var bordercolor="";
        var message = "";
        var s;

        for(var i = 0; i < rho.length; i++) { // устаревание статистики
          for(var j = 0; j < rho.length; j++) {
                rho[i][j]*=parameters.trace;
            }
        }

        for(var key in players) { // по всем играющим клиентам
            if (players[key]!=undefined && opponents[key].players[0] == key) { // выводим только для первого игрока в паре
                s = getStrategies(key); // вычислить профиль стратегий
                rho[Math.max(s.x,s.y)][Math.min(s.x,s.y)]+=(1-parameters.trace)/2; // обновить плотность профилей стратегий
                //console.log(rho[Math.max(s.x,s.y)][Math.min(s.x,s.y)]);
                if(maxrho<rho[Math.max(s.x,s.y)][Math.min(s.x,s.y)]) {
                    maxrho=rho[Math.max(s.x,s.y)][Math.min(s.x,s.y)];
                }
                    
                // вычислить выигрыш, текущий игрок всегда считается первым
                f = getPayoff(1, s);
                console.log('Game '+JSON.stringify(opponents[key].players)+': '+JSON.stringify(s)); // записать стратегии в лог для статистики
                message += '<div class="small_wrap">'
                message += drawField(1, s); // нарисовать поле для текущего игрока
                message +='</div>';
            }
        }
        hist = '<p><div id=hist><table width=300 height=300 style="border-collapse:collapse">';

        for(var i = 0; i < rho.length; i++) {
            var row = rho[i];
            hist+='<tr>';
            for(var j = 0; j < row.length; j++) {
                b = Math.min(255,Math.max(0,Math.floor((1-rho[i][j]/maxrho)*255))).toString(16); // brightness
                if(i<j) {
                    bordercolor='style="border: 0px;"';
                } else if(Math.round(i-size*size/3)==0 && Math.round(j-size*size/3)==0) {
                    bordercolor='style="border: 2px solid red;"';
                } else if(Math.round(i+j-size*size/2)==0) {
                    bordercolor='style="border: 2px solid green;"';
                } else {
                    bordercolor='style="border: 1px dotted silver;"';
                }
                hist+='<td bgcolor="#'+b+b+b+'" '+bordercolor+'></td>'; // draw the density colormap
                } 
            hist+='</tr>';
        } 
    hist+='</table></div></p>';
    ws.send(hist+message); 
    }
}); // end admin websoket events definition

// функция сбрасывает статистику по всем сессиям
function restartStats() {
    for(var key in players) { // по всем играющим клиентам, в том числе, неактивным
        clearHistory(key);
    }
}

// функция сбрасывает статистику по коду id сессии
function clearHistory(id) {
    history[id]=Array(parameters.historydepth).fill(null); // заполнить нулями историю выигрышей
    payoffs[id]=0; // начальный выигрыш
}

function shufflePlayers() {
    var allparties = Object.keys(players); // копия номеров сессий в виде массива строк!
    var parties = allparties.filter(x => !clients.includes(x) ); // оставить только играющие сессии 
    var newopponents={}; // новая таблица оппонентов 
    console.log('Перемешиваем!');
    console.log(JSON.stringify(opponents));
    console.log(JSON.stringify(allparties));
    shuffle(parties); // перемешать клиентские сессии
    for(let i=0;i<parties.length; i+=parameters.n) { // перечислить все новые комплекты игроков
        ops = parties.slice(i, i+parameters.n);
        for(let j=0;j<ops.length; j++) {
            newopponents[ops[j]]={players:ops};
        }
    }
    opponents = newopponents;
}

function shuffle(array) {
  array.sort(() => Math.random() - 0.5);
}

function Round(num,dig) {
    return Math.round( num * Math.pow(10,dig) + Number.EPSILON ) / Math.pow(10,dig);
}

console.log('Сервер запущен на портах ' +parameters.statsport+', '+parameters.port+', '+parameters.adminport);