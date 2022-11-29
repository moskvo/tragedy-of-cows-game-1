'use strict';

//let http = require('http'); 
//let Static = require('node-static');

import { parameters } from "./cowsparameters.mjs";
import { TragedyOfCommons, Group } from "./common.mjs";
import { WebSocketServer } from 'ws';
import { EventEmitter } from 'events';
import { writeFileSync, writeSync } from 'fs';

import diophant from 'diophantine'

const gameapi = {
    new_game: (n,A) => new TragedyOfCommons(n,A),
    fields_ids: (n) => Array.from({length: n}, (_, i) => 'f'+(i+1)),
    };

console.log('FIELD SIZES = '+JSON.stringify(parameters.fieldsize));

// глобальные переменные:
// подключенные клиенты
let players_sockets = {};
// история выигрышей
let history = {}; 
// накопленный выигрыш
let payoffs = {};
// перемешивать игроков каждый период
let shuffleflag = false;

const groups = [];
const group_of_player = {};

// сообщения для админа (-ов?)
const events2admin = new EventEmitter();


let clients = []; // переменная, которая хранит ID сессий при комплектовании игроками игры 
let clients_sockets = {} // переменная, которая хранит ссылку на сокет при комплектовании игроками игры
// при этом история выигрышей сессии никогда не очищается, и, потому, сохраняется 

// старутем WebSocket-сервер на порту, определяемом параметрами в файле
const webSocketServer = new WebSocketServer({port: parameters.port});

webSocketServer.on('connection', function(ws,req) { // запускается, когда новый клиент присоединяется к серверу
    let id = req.socket.remoteAddress; // ID новой сессии - ip !менял connection на socket
    if( ! parameters.singleuser ) {
        id = Math.random().toString()+id; // ID новой сессии - float от 0 до 1 + IP
        }
    clearHistory(id); // обнулить историю. при этом история выигрышей сессии никогда не очищается, и, потому, сохраняется 
    
    // запрет сессий с одинаковым ID
    if ( players_sockets[id] != undefined || clients_sockets[id] != undefined ) {
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
                if( ops[i] != id && players_sockets[ops[i]] != null) {
                    players_sockets[ops[i]].send(JSON.stringify({ deletegame: true }));
                    addSessionToWaitingList(ops[i], players_sockets[ops[i]]); // поместить оппонентов в ожидающие сессии
                    }
                }

            delete players_sockets[id]; // вычистить выбывшего игрока из массива играющих сессий

            // сообщение админу
            events2admin.emit('deletegroup', { 
                deletegroup : {number: thegroup.number}
                })
        }
    });

}); // end websoket events definition

function addSessionToWaitingList(player_id, wws) { // инлайновая функция
    players_sockets[player_id] = undefined; // вычистить (на всякий случай) из массива играющих сессий
    group_of_player[player_id] = undefined;

    clients.push(player_id); // добавить новую сессию в список игроков
    clients_sockets[player_id] = wws; // добавить ссылку на сокет в список игроков
    
    if ( clients.length == get_group_size(parameters.n) ) { // если набрался полный комплект участников
        let sz = pop_group_size(parameters.n)
        let subgame = gameapi.new_game(sz,parameters.fieldsize[sz]);
        let g = new Group(subgame, clients, clients_sockets);
        g.choices_done = true; // для отправки начальной ситуации (0,0,0)
        groups.push(g);
        for ( let id of clients ) {
            players_sockets[id] = clients_sockets[id]; // поместить игрока в таблицу 
            players_sockets[id].send(JSON.stringify({
                newgame     : true,
                playertype  : g.ids_players_map.get(id),
                n           : subgame.players.length,
                fieldsize   : subgame.A
                } 
                ));
            console.log('поместить в таблицу играющих ID='+id);
            group_of_player[id] = g;
            }
        history[g.number] = {0: g.situation};
        clients = []; // готов формировать новый комплекс игроков
        clients_sockets = {};
        events2admin.emit('newgroup', {
            newgroup: {
                number : g.number,
                fieldsize : subgame.A,
                playerscount: subgame.players.length 
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
            let message = { showcontrols: false };
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
        const [allocation_fields,offside] = solveCollisionsOnFields(gameapi.fields_ids(g.game.A),g.situation);
        let newsituation = g.empty_situation();
        for( let [f,pl] of allocation_fields ){
            newsituation.get(pl).push(f);
            }
    

        // send next round payoffs and situation
        g.get_payoffs()
        .then(map_payoffs => {
            for( let i in g.players_ids ) {
                let id = g.players_ids[i];
                players_sockets[id].send(
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
        history[g.number][g.round] = { situation: [...newsituation]}
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
let adminServer = new WebSocketServer({port: parameters.adminport});

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
            // если отправлено новое число игроков
            if(command.players_count ) {
                set_groups_sizes( command.players_count )
               }
            } 
        else { 
            verified = false;
            }
        });
    
    let fnsend = (msg) => ws.send(JSON.stringify(msg));
    ws.on('close', function(err) { // обработка закрытия сессии
        console.log('закрывается админская сессия ' + err);
        events2admin.removeListener('curstate',fnsend)
                    .removeListener('newgroup',fnsend)
                    .removeListener('deletegroup',fnsend);
        });
  
    /*if ( ! verified ) {
        ws.close(1008,'пароль неверный')
        return;
        }*/

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
            message.push( [g.number, history[g.number][g.round].situation, g.game.A, g.round] )
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
    for(let key in players_sockets) { // по всем играющим клиентам, в том числе, неактивным
        clearHistory(key);
    }
}

// функция сбрасывает статистику по коду id сессии
function clearHistory(id) {
    if( history[id] ){
        history['id'+Math.random().toString()] = history[id]
        history[id] = undefined
    }
}

function shufflePlayers() {
    let allparties = Object.keys(players_sockets); // копия номеров сессий в виде массива строк!
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

// grouping by groupsize 3 or 5
//   n must be >=3 and not 4 or 7
const g1 = 3;
const g2 = 5;
let groups_sizes = [];
function grouping( n ) {
    const { solutionType, g, z, m, p } = diophant.dioSolve(g1, g2, n)

    // despite that i check that solution will be linear up to n=200
    if( solutionType != diophant.SolutionType.Linear || m[1] == 0){
        throw Error('in cowsserver.js, grouping() n='+n);
        }
    
    let k = - p[1] / Math.abs(m[1]);
    let step = (m[1]>0) ? 1 : -1;
    k = (step>0) ? Math.ceil(k) : Math.floor(k)
    let [groupsby3,groupsby5] = [ m[0] * k + p[0], m[1] * k + p[1] ]
    
    //console.log(`Solutions: x = ${m[0]}n + ${p[0]}, y = ${m[1]}n + ${p[1]}`)
    
    return Array.from( {length:groupsby5+groupsby3}, (_,i)=>(i<groupsby5)?5:3 );
}
const pop_group_size = (n) => groups_sizes.pop() || n ;
const get_group_size = (n) => groups_sizes[groups_sizes.length-1] || n ;
function set_groups_sizes (n) { groups_sizes = grouping( n ) }

set_groups_sizes( parameters.players_count )


console.log('Сервер запущен на портах ' +parameters.statsport+', '+parameters.port+', '+parameters.adminport);

function dateForFilename(date){
    // toISOString return: 2011-10-05T14:48:00.000Z
    return date.toISOString().replaceAll(':','-').split('.')[0]
}

process.on('SIGTERM',()=>{
    console.log('TERM');
    try {
        writeFileSync('./cowsgame-log-'+dateForFilename(new Date())+'.log', JSON.stringify(history));
        }
    catch(error){ console.log(error)}
    finally {
        process.exit();
        }
    });
process.on('SIGINT',()=>{
    console.log('INT, then emit TERM');
    process.emit('SIGTERM');
    });
process.on('uncaughtException', (err,origin)=>{
    try {
        writeFileSync('cowsgame-log-'+dateForFilename(new Date())+'.log', JSON.stringify(history));
        writeSync(
            process.stderr.fd,
            `Caught exception: ${err}\n` +
            `Exception origin: ${origin}\n`
            );
        writeSync(process.stdout.fd,'uncaughtException, exit');
        }
    finally{
        process.exit();
        }
    });

