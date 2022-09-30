'use strict';

//var http = require('http'); 
//var Static = require('node-static');

var parameters = require("./cowsparameters");
const gameapi = {
    new_game: () => new parameters.TheGame(parameters.n,parameters.fieldsize),
    fields_ids: Array.from({length: parameters.n}, (_, i) => 'f'+(i+1)),
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
const Group = parameters.Group;


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
            strategies[id] = x.action;
            }
        if( x.choice ){
            strategies[id] = x.choice;
            player_in_group[id].fixChoice(id,x.choice);
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
        g.choices_done = true; // для отправки начальной ситуации (0,0,0)
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

function connectInfo() {
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

    groups.filter(g=>g.choices_done).forEach( g=>{
        // solve game
        let ids = g.player_ids;
        let situation = g.situation;
        let round = g.round;

        // solve possible collisions
        const [allocation_fields,offside] = solveCollisionsOnFields(gamepi.fields_ids,situation);
        let newsituation = g.empty_situation();
        for( [f,ps] of allocation_fields.entries() ){
            newsituation.get(ps).push(f);
            }
    

        // send next round payoffs and situation
        g.get_payoffs()
        .then(map_payoffs => {
            for( let id of ids ) {
                clients_sockets[id].send(
                    JSON.stringify({
                        newround: true,
                        round: round+1,
                        situation: newsituation, 
                        payoff: map_payoffs[id],
                        offside: offside
                        })
                    );
                }

            })
        });

    if(shuffleflag) { // если режим перемешивания, то для следующего периода перемешать игроков
        shufflePlayers();
        }
    }

function solveCollisionsOnFields(fields_ids,situation){
    // form cows allocation on fields
    let cows_fields_alloc = new Map();
    let empty_fields = new Set(fields_ids);
    for( [player,v] of situation.entries() ){
        for(let e of v) {
            if( empty_fields.delete(e) ) cows_fields_alloc.set(e,[]);
            cows_fields_alloc.get(e).push(player);
            }
        }

    // form allocation with 1cow-1field
    let off_side = []; // excess cows
    let onecow_onefield_alloc = new Map();
    empty_fields = [... empty_fields];
    for( [f,ar_pl] of cows_fields_alloc.entries() ){
        // place one random cow
        let i = random_index(ar_pl);
        onecow_onefield_alloc.set(f,ar_pl[i]);
        // place others to empty fields;
        let others = Array.from(ar_pl); others.splice(i,1);
        let cnt = Math.min(others.length, empty_fields.length);
        for( let i = 0; i < cnt ; i++ ){
            let [o,e] = [others.pop(), empty_fields.pop()];
            onecow_onefield_alloc.set(e,o);
            }
        if( others.length > 0 ){
            off_side.push(...others);
            }

        }
    
    return [onecow_onefield_alloc,off_side];
    }
function random_index(items){
    return Math.floor(Math.random()*items.length);
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
        if( command.password =='trapeznikov') { // если передан пароль, причем правильный
            verified = true;
            if(command.restart) { // если запрошен рестарт статистики
                console.log('запрошен рестарт');
                restartStats();
            }
            if(command.shuffle) { // если запрошено перемешать игроков
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
    
    function sendAdmin() {
        if(verified === false) { // отображать только авторизованным админам
            return;
            }
        var f;
        var bordercolor="";
        var message = "";
        var s;

        for(var key in players) { // по всем играющим клиентам
            if (players[key] && opponents[key].players[0] == key) { // выводим только для первого игрока в паре
                s = getStrategies(key); // вычислить профиль стратегий
                    
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