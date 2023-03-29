'use strict';
 
const _moscowdate = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'long', timeZone: 'Europe/Moscow', hour12: false });
 
import { parameters } from "./cowsparameters.mjs";
 
import express from 'express';
const app = expresdtas();
 
app.use(express.static('.'));
 
{
    const host = parameters.IP;
    const port = parameters.statsport;
    app.listen(port, host, function () {
        console.log(`Web server listens http://${host}:${port}`);
    });
}
 
 
import { TragedyOfCommons, Group } from "./common.mjs";
import { WebSocketServer } from 'ws';
import { EventEmitter } from 'events';
import { writeFileSync, writeSync } from 'fs';
 
const gameapi = {
    new_game: (dt, clnts_ids,A) => new TragedyOfCommons(dt, clnts_ids,A),
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
 
//const groups = [];
//const group_of_player = {};
const group_work = new GroupWork( parameters.players_count, 3, 5 ) ;

const datatable = {} // где создаётся объект для каждого игрока?
 
// сообщения для админа (-ов?)
const events_emitter = new EventEmitter();
 
let clients_ids = []; // переменная, которая хранит ID сессий при комплектовании игроками игры
let clients_sockets = {}; // переменная, которая хранит ссылку на сокет при комплектовании игроками игры
// при этом история выигрышей сессии никогда не очищается, и, потому, сохраняется
 
// стартуем WebSocket-сервер на порту, определяемом параметрами в файле
const webSocketServer = new WebSocketServer({port: parameters.port});
 
webSocketServer.on('connection', function(ws,req) { // запускается, когда новый клиент присоединяется к серверу
    let id = req.socket.remoteAddress; // ID новой сессии - ip !менял connection на socket
    if( ! parameters.singleuser ) {
        id = Math.random().toString()+id; // ID новой сессии - float от 0 до 1 + IP
        }
    clearHistory(id); // обнулить историю. при этом история выигрышей сессии никогда не очищается, и, потому, сохраняется
    
    // запрет сессий с одинаковым ID
    if ( datatable[id] !== undefined || clients_sockets[id] !== undefined ) {
        ws.send(JSON.stringify({HTML: "<h1>Одному игроку запрещено запускать несколько игровых сессий!</h1>"}));
        console.log("дублирующая сессия, ID = "+id);
        //ws.close();
        return false;
        }
    console.log("новая сессия, ID = " + id + " at " + _moscowdate.format(+new Date()) );
    addSessionToWaitingList(datatable, id, ws, group_work);
               
                // Обработчики событий
    ws.on('message', function(message) { // игроки присылают на сервер свои стратегии в сообщениях
        console.log('получено сообщение ' + message);
        let x = JSON.parse(message); // предполагается, что стратегия передается в JSON
        if( x.action ){
            }
        if( x.choice ){
            datatable[id].groupcls.fixChoice(datatable, id, x.choice);
            }
        });
 
      
    ws.on('close', function() { // обработка закрытия сессии
        if ( clients_sockets[id] ) { // если сессия закрылась на этапе ожидания
            console.log('гасим ожидающую сессию id=' +id  + " at " + _moscowdate.format(+new Date()));
            delete clients_sockets[id]; // вычистить клиента из массива ожидающих сессий           
            let index = clients_ids.indexOf(id);
            if (index > -1) {
               clients_ids.splice(index, 1);
            }// вычистить из списка оппонентов
 
        } else { // при закрытии играющей сессии принудительно ставятся в очередь сессии и всех оппонентов
            console.log('гасим играющую сессию id=' +id  + " at " + _moscowdate.format(+new Date()));
 
            // удаляем группу из списков групп
            let thegroup = datatable[id].groupcls; // group_of_player[id];
            delete datatable[id].player_socket
            delete_group( thegroup, id );
 
//           ## // сохранить историю?
//            ## delete players_sockets[id]; // вычистить выбывшего игрока из массива играющих сессий
 
            // сообщение админу
            events_emitter.emit('deletegroup', {
                deletegroup : {number: thegroup.number}
                })
        }
    });
 
}); // end websoket events definition
 
// in it?:
//      diophant
//      clients?
import diophant from 'diophantine'

class GroupWork {
    constructor( players_count, group1_size, group2_size ){
        this.groups = [];
        this.group_of_player = {};
        this.g1 = group1_size;
        this.g2 = group2_size;
        this.groups_sizes = [];
        this.players_count = players_count
        this.set_groups_sizes( players_count ) ;
        }

    // grouping n players by groupsize 3 or 5
    //   n must be >=3 and not 4 or 7
    grouping( n ) {
        const { solutionType, g, z, m, p } = diophant.dioSolve(this.g1, this.g2, n)

        // despite that i check that solution will be linear up to n=200
        if( solutionType !== diophant.SolutionType.Linear || m[1] === 0){
            throw Error('in cowsserver.js, grouping() n='+n);
            }

        let k = - p[1] / Math.abs(m[1]);
        let step = (m[1]>0) ? 1 : -1;
        k = (step>0) ? Math.ceil(k) : Math.floor(k)
        let [groupsby3,groupsby5] = [ m[0] * k + p[0], m[1] * k + p[1] ]

        //console.log(`Solutions: x = ${m[0]}n + ${p[0]}, y = ${m[1]}n + ${p[1]}`)
        return Array.from( {length:groupsby5+groupsby3}, (_,i)=>(i<groupsby5)?5:3 );
        }

    pop_group_size (n) {
        return this.groups_sizes.pop() || n ;
        }
    get_group_size (n) {
        return this.groups_sizes[this.groups_sizes.length-1] || n ;
        }
    set_groups_sizes (n) { this.groups_sizes = this.grouping( n ) }

    create_group(dt, gclients_ids, gclients_sockets) {
        let g = new Group(dt, gclients_ids);
        g.choices_done = true; // для отправки начальной ситуации (0,0,0)
        this.groups.push(g);
        for ( let id of gclients_ids ) {
            dt[id] = dt[id] || {};
            dt[id].player_socket = gclients_sockets[id]; // сохранить сокет
            this.group_of_player[id] = g;
            }
        return g;
        }
 
    //delete
    delete_group( dt, group, except_id=null ){
        let groupindex = this.groups.indexOf(group);
        if( groupindex === -1 ) { console.log( "websocket on close - WARNING: I haven't found group" ); }
        else { this.groups.splice(groupindex,1); }
     
        // сессии всех остальных оппонентов в таблицу ожидания
        let ops = group.players_ids;
        let ids = [], wsocks = {};
        for( let id of ops ) {
            delete this.group_of_player[id];
            if( id !== except_id ) {
                dt[id].player_socket.send(JSON.stringify({ deletegame: true }));
                ids.push(id);
                wsocks[id] = dt[id].player_socket;
                }
            }
   
        return [ ids, wsocks ];
        }

    } // class GroupWork
 
function delete_group( group, id ) {
    const [ids, wsocks] = group_work.delete_group( datatable, group, id );
    // поместить оппонентов в ожидающие сессии
    for( let oid of ids ) {
        addSessionToWaitingList(datatable, oid, wsocks[oid], group_work);
        }
    }
function shuffle_groups( groups ){
    let all_players_ids = []
    for ( let g in groups ){
        all_players_ids.push(...g.players_ids);
        }

    shuffle(all_players_ids);

    // grouping

    // поставить ожидающих на паузу
    let clients_wait = [...clients_ids];
    let clients_sockets_wait = [...clients_sockets];
    [clients_ids, clients_sockets] = [ [], [] ]

    for( let pid in all_players_ids ){
        addSessionToWaitingList(datatable, pid, datatable[pid].player_socket, group_work);
        }

    // вернуть ожидающих на ожидание
    clients_ids = clients_wait;
    clients_sockets = clients_sockets_wait;
}


 
 
function addSessionToWaitingList(dt, player_id, wws, group_work) { // инлайновая функция
    clients_ids.push(player_id); // добавить новую сессию в список игроков
    clients_sockets[player_id] = wws; // сохранить ссылку на сокет
 
    if ( clients_ids.length === group_work.get_group_size(parameters.n) ) { // если набрался полный комплект участников
        group_work.pop_group_size(parameters.n);
        for( let id of clients_ids ){
            dt[id] = dt[id] || {};
            }

        let g = group_work.create_group(dt, clients_ids, clients_sockets);
        let size = clients_ids.length;
        // создаём локальную игру в группе
        let subgame = gameapi.new_game(dt, clients_ids, parameters.fieldsize[size]);

//        ## history[g.number] = {0: g.situation};
 
        for ( let id of clients_ids ) {
            clients_sockets[id].send(
                    JSON.stringify({
                        newgame     : true,
                        playertype  : dt[id].player,
                        n           : size,
                        fieldsize   : subgame.A
                        })
                    );
            }
        clients_ids = []; // готов формировать новый комплекс игроков
        clients_sockets = {};
 
        events_emitter.emit('newgroup', {
            newgroup: {
                number : g.number,
                fieldsize : subgame.A,
                playerscount: size
                }
            });
        }// if
    }
 
 
// Посылать информацию о подключении каждые updateinterval милисекунд
setInterval(connectInfo, parameters.updateinterval);
 
// Обновлять игровые поля каждые updateinterval милисекунд
setInterval(sendFields, parameters.updateinterval);
 
function connectInfo() {
    for(let soc in clients_sockets) { // по всем клиентам, ожидающим подключения
        if (clients_sockets[soc]!==undefined) {
            let message = { showcontrols: false };
            message.HTML ='<div class="blind-text"><h2>Ожидание подключения еще '+ (parameters.n-clients_ids.length)+ ' игроков для начала игры...</h2></div>';
            clients_sockets[soc].send(JSON.stringify(message));
            }
        }
    }
 
// это основная функция, которую необходимо модифицировать от игры к игре
// она вычисляет выигрыши всех игроков, рисует поле в html и отправляет его для отображения клиенту
function sendFields() {       
    group_work.groups.filter(g=>g.choices_done).forEach( g=>{
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
        history[g.number][g.round] = { situation: [...newsituation] }
        //
        });
 
    if(shuffleflag) { // если режим перемешивания, то для следующего периода перемешать игроков
        shuffle_groups( group_work.groups );
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
 
// старутем WebSocket-сервер на порту, определяемом параметрами в файле
let adminServer = new WebSocketServer({port: parameters.adminport});
 
adminServer.on('connection', function(ws) { // запускается, когда админ присоединяется к серверу
    console.log('новая админская сессия');
    let verified = false;
               
    // Обработчики событий
    ws.on('message', function(message) { // админ присылает на сервер пароль и команды обнуления статистики
        console.log('получено админское сообщение');
        let command = JSON.parse(message); // предполагается, что команда передается в JSON
        if( command.password ==='trapeznikov') { // если передан пароль, причем правильный
            verified = true;
            if(command.restart) { // если запрошен рестарт статистики
                console.log('запрошен рестарт');
                restartStats();
                }
            if(command.shuffle) { // если запрошено перемешать игроков
                shuffleflag = command.shuffle;
                console.log('перемешивать игроков = ' + shuffleflag.toString());
                // перемешивание
                }
            // если отправлено новое число игроков
            if(command.players_count ) {
                group_work.set_groups_sizes( command.players_count )
               }
            }
        else {
            verified = false;
            }
        });
   
    let fnsend = (msg) => ws.send(JSON.stringify(msg));
    ws.on('close', function(err) { // обработка закрытия сессии
        console.log('закрывается админская сессия ' + err);
        events_emitter.removeListener('curstate',fnsend)
                    .removeListener('newgroup',fnsend)
                    .removeListener('deletegroup',fnsend);
        });
 
    /*if ( ! verified ) {
        ws.close(1008,'пароль неверный')
        return;
        }*/
 
    events_emitter.on('curstate',fnsend)
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
        for( let g of group_work.groups ) { // по всем группам
            // номер группы, профиль стратегий, размер поля, раунд
            message.push( [g.number, history[g.number][g.round].situation, g.game.A, g.round] )
            plcnt += g.players_ids.length;
            }
 
        s = {
            curstate: message,
            playerscount: plcnt,
            groupscount: group_work.groups.length,
            waiterscount: clients_ids.length
            };
        events_emitter.emit('curstate', s);
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
 
function shuffle(array) {
    array.sort(() => Math.random() - 0.5);
    }
 
function Round(num,dig) {
    return Math.round( num * Math.pow(10,dig) + Number.EPSILON ) / Math.pow(10,dig);
    }
 
 
console.log('WebSocket Сервер запущен на портах ' +parameters.statsport+', '+parameters.port+', '+parameters.adminport);
 
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