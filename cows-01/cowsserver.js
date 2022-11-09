'use strict';

//let http = require('http'); 
//let Static = require('node-static');

const parameters = require("./cowsparameters");
const WebSocketServer = new require('ws');
const EventEmitter = require('events');

const gameapi = {
    new_game: (n,A) => new parameters.TheGame(n,A),
    fields_ids: Array.from({length: parameters.fieldsize}, (_, i) => 'f'+(i+1)),
    };

console.log('FIELD SIZE = '+String(parameters.fieldsize));

// глобальные переменные:
// подключенные клиенты
let players = {};
// история выигрышей
let history = {}; 
// накопленный выигрыш
let payoffs = {};
// перемешивать игроков каждый период
let shuffleflag = false;

const groups = [];
const group_of_player = {};
const Group = parameters.Group;

// сообщения для админа (-ов?)
const events2admin = new EventEmitter();


let clients = []; // переменная, которая хранит ID сессий при комплектовании игроками игры 
let clients_sockets = {} // переменная, которая хранит ссылку на сокет при комплектовании игроками игры
// при этом история выигрышей сессии никогда не очищается, и, потому, сохраняется 

// старутем WebSocket-сервер на порту, определяемом параметрами в файле
const webSocketServer = new WebSocketServer.Server({port: parameters.port});

webSocketServer.on('connection', function(ws,req) { // запускается, когда новый клиент присоединяется к серверу
    let id = req.socket.remoteAddress; // ID новой сессии - ip !менял connection на socket
    if( ! parameters.singleuser ) {
        id = Math.random().toString()+id; // ID новой сессии - float от 0 до 1
        }
    clearHistory(id); // обнулить историю. при этом история выигрышей сессии никогда не очищается, и, потому, сохраняется 
    
    // запрет сессий с одинаковым ID
    if ( players[id] != undefined || clients_sockets[id] != undefined ) {
        ws.send(JSON.stringify({HTML: "<h1>Одному игроку запрещено запускать несколько игровых сессий!</h1>"}));
        console.log("дублирующая сессия, ID = "+id);
        //ws.close();
        return false;
        }
    console.log("новая сессия, ID = "+id);

    addSessionToWaitingList(id, ws);
       
    ws.on('close', function() { // обработка закрытия сессии
        if (clients_sockets[id] != null) { // если сессия закрылась на этапе ожидания
            console.log('гасим ожидающую сессию id=' +id);
            delete clients_sockets[id]; // вычистить клиента из массива ожидающих сессий            
            let index = clients.indexOf(id);
            if (index > -1) {
               clients.splice(index, 1);
            }// вычистить из списка оппонентов

        } else { // при закрытии играющей сессии принудительно ставятся в очередь сессии и всех оппонентов
            console.log('гасим играющую сессию id=' +id);

            // удаляем группу из списков групп
            let thegroup = group_of_player[id];
            let groupindex = groups.indexOf(thegroup);
            if( groupindex == -1 ) { console.log( "websocket on close - WARNING: I haven't found group" ); }
            else{ groups.splice(groupindex,1); }
            delete group_of_player[id];
            
            // сессии всех остальных оппонентов в таблицу ожидания
            let ops = thegroup.players_ids; 
            for(let i in ops) { 
                if( ops[i] != id && players[ops[i]] != null) {
                    addSessionToWaitingList(ops[i], players[ops[i]]); // поместить оппонентов в ожидающие сессии
                    }
                }

            delete players[id]; // вычистить выбывшего игрока из массива играющих сессий

            // сообщение админу
            events2admin.emit('deletegroup', { 
                deletegroup : {number: thegroup.number}
                })
        }
    });

}); // end websoket events definition

function addSessionToWaitingList(player_id, wws) { // инлайновая функция
    players[player_id] = undefined; // вычистить (на всякий случай) из массива играющих сессий
    group_of_player[player_id] = undefined;

    clients.push(player_id); // добавить новую сессию в список игроков
    clients_sockets[player_id] = wws; // добавить ссылку на сокет в список игроков
    
    if ( clients.length == parameters.n ) { // если набрался полный комплект участников
        let subgame = gameapi.new_game(parameters.n,parameters.fieldsize);
        let g = new Group(subgame, clients, clients_sockets);
        g.choices_done = true; // для отправки начальной ситуации (0,0,0)
        groups.push(g);
        for ( let id of clients ) {
            players[id] = clients_sockets[id]; // поместить игрока в таблицу 
            players[id].send(JSON.stringify( 
                {playertype: g.ids_players_map.get(id)} ));
            console.log('поместить в таблицу играющих ID='+id);
            group_of_player[id] = g;
            }
        clients = []; // готов формировать новый комплекс игроков
        clients_sockets = {};
        events2admin.emit('newgroup', {
            newgroup: {
                number : g.number,
                fieldsize : g.game.A,
                playerscount: g.players_ids.length 
                }
            })
        }
    }


// Посылать информацию о подключении каждые updateinterval милисекунд
setInterval(connectInfo, parameters.updateinterval);

// Обновлять игровые поля каждые updateinterval милисекунд
setInterval(sendFields, parameters.updateinterval);

function connectInfo() {
    for(let soc in clients_sockets) { // по всем клиентам, ожидающим подключения
        if (clients_sockets[soc]!=undefined) {
            let message={ showcontrols: false };
            message.HTML ='<div class="blind-text"><h2>Ожидание подключения еще '+ (parameters.n-clients.length)+ ' игроков для начала игры...</h2></div>';
            clients_sockets[soc].send(JSON.stringify(message));
            }
        }
    }

// это основная функция, которую необходимо модифицировать от игры к игре
// она вычисляет выигрыши всех игроков, рисует поле в html и отправляет его для отображения клиенту
function sendFields() {        
    groups.filter(g=>g.choices_done).forEach( g=>{
        // solve game

        // solve possible collisions
        const [allocation_fields,offside] = solveCollisionsOnFields(gameapi.fields_ids,g.situation);
        let newsituation = g.empty_situation();
        for( let [f,pl] of allocation_fields ){
            newsituation.get(pl).push(f);
            }
    

        // send next round payoffs and situation
        g.get_payoffs()
        .then(map_payoffs => {
            for( let i in g.players_ids ) {
                let id = g.players_ids[i];
                players[id].send(
                    JSON.stringify({
                        newround: true,
                        round: g.round+1,
                        situation: [...newsituation], 
                        payoff: map_payoffs[i],
                        offside: offside
                        })
                    );
                }

            });
        g.next_round();
        // 
        });

    if(shuffleflag) { // если режим перемешивания, то для следующего периода перемешать игроков
        shufflePlayers();
        }
    }

function solveCollisionsOnFields(fields_ids,situation){
    console.log([...situation]);
    // form cows allocation on fields
    let cows_fields_alloc = new Map();
    let empty_fields = new Set(fields_ids);
    for( let [player,v] of situation ){
        for(let e of v) {
            if( empty_fields.delete(e) ) { cows_fields_alloc.set(e,[]); }
            cows_fields_alloc.get(e).push(player);
            }
        }

    // form allocation with 1cow-1field
    let off_side = []; // excess cows
    let onecow_onefield_alloc = new Map();
    empty_fields = [... empty_fields];
    for( let [f,ar_pl] of cows_fields_alloc ){
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


// ДЛЯ АДМИНА
// обычный сервер (статика) на порту 8080
//let fileServer = new Static.Server('.');
//http.createServer(function (req, res) {
//  
//  fileServer.serve(req, res);
//
//}).listen(8080);

// старутем WebSocket-сервер на порту, определяемом параметрами в файле
let adminServer = new WebSocketServer.Server({port: parameters.adminport});

adminServer.on('connection', function(ws) { // запускается, когда админ присоединяется к серверу
    console.log('новая админская сессия');
    let verified = false;
                
    // Обработчики событий 
    ws.on('message', function(message) { // админ присылает на сервер пароль и команды обнуления статистики
        console.log('получено админское сообщение');
        let command = JSON.parse(message); // предполагается, что команда передается в JSON 
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
            } 
        else { 
            verified = false;
            }
        });
    
    let fnsend = (msg) => ws.send(msg);
    ws.on('close', function() { // обработка закрытия сессии
        console.log('закрывается админская сессия');
        events2admin.removeListener('curstate',fnsend)
                    .removeListener('newgroup',fnsend)
                    .removeListener('deletegroup',fnsend);
        });
  
    if ( ! verified ) {
        ws.close(1008,'пароль неверный')
        return;
        }

    events2admin.on('curstate',fnsend)
                .on('newgroup',fnsend)
                .on('deletegroup',fnsend);

    // Посылать информацию об игре админу каждые updateinterval милисекунд
    setInterval(sendAdmin, parameters.updateinterval);
    
    function sendAdmin() {
        if(verified === false) { // отображать только авторизованным админам
            return;
            }
        let message = [];
        let s;

        let plcnt = 0;
        for( let g of groups ) { // по всем группам
            // номер группы, профиль стратегий, размер поля, раунд
            message.push( [g.number, [...g.situation], g.game.A, g.round] )
            plcnt += g.players_ids.length;
            }

        s = {
            curstate: message,
            playerscount: plcnt,
            groupscount: groups.length,
            waiterscount: clients.length
            };
        events2admin.emit('curstate', s);
        }
    }); // end admin websoket events definition

// функция сбрасывает статистику по всем сессиям
function restartStats() {
    for(let key in players) { // по всем играющим клиентам, в том числе, неактивным
        clearHistory(key);
    }
}

// функция сбрасывает статистику по коду id сессии
function clearHistory(id) {
    history[id]=Array(parameters.historydepth).fill(null); // заполнить нулями историю выигрышей
    payoffs[id]=0; // начальный выигрыш
}

function shufflePlayers() {
    let allparties = Object.keys(players); // копия номеров сессий в виде массива строк!
    let parties = allparties.filter(x => !clients.includes(x) ); // оставить только играющие сессии 
    let newopponents={}; // новая таблица оппонентов 
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