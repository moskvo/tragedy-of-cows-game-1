'use strict';

import { TragedyOfCommons, VideoGame } from "./common.mjs";
import { parameters } from "./cowsparameters.mjs";


if (!window.WebSocket) {
     document.body.innerHTML = 'WebSocket в этом браузере не поддерживается.';
    }

// создать подключение
var socket;

// послать пароль на сервер
function connect() {  
    var outgoingMessage = JSON.stringify({password: document.getElementById('adminPassword').value});
    socket.send(outgoingMessage);
    return false;
    }

// обнулить статистику
function restart() {  
    var outgoingMessage = JSON.stringify({password: document.getElementById('adminPassword').value, restart: 1});
    socket.send(outgoingMessage);
    return false;
    }
// перемешать игроков
function shuffle() {  
    var outgoingMessage = JSON.stringify({
        password: document.getElementById('adminPassword').value, 
        shuffle: document.getElementById('shuffle').checked
    });
    socket.send(outgoingMessage);
    return false;
    }

// показать текущее состояние поля в div#field
function showMessage(message) {
    document.getElementById('fields').innerHTML = message;
    }

let groups_ids = [];
let videogames = new Map();

document.addEventListener("DOMContentLoaded", function(event) {
    document.getElementById("players_count").setAttribute('value', parameters.players_count)
    document.querySelectorAll('div.cows-game').forEach( cows_game => {
        let fieldsize = (parameters.n==3) ? 12 : 30;
        let tgame = new TragedyOfCommons(n,fieldsize);
        let opts = {
            game:tgame,
            player:[1,2],
            gamescreen_element:cows_game,
            //situation: new Map([ [1,[]], [2,['f2','f3']], [3,['f4','f5','f6']] ])
            }
        videogame = new VideoGame(opts);  
        })
    
    socket = new WebSocket('ws://'+parameters.IP+':'+parameters.adminport);

    // обработчик входящих сообщений
    socket.onmessage = function(event) {
        var incomingMessage = JSON.parse(event.data);
        console.log('received message '+incomingMessage);
        //showMessage(incomingMessage);
        const {deletegroup, newgroup, curstate, playerscount, groupscount, waiterscount} = incomingMessage
        if( curstate ){
            document.getElementById("players").innerText = playerscount;
            document.getElementById("groups").innerText = groupscount;
            document.getElementById("waiters").innerText = waiterscount;

            // group - [number, situation, fieldsize, round]
            for( let group of curstate ){
                if( ! videogames.has(group[0]) ){
                    create_screen_and_game( group[0], group[1].length, group[2] )
                    }
                videogames.get(group[0])
                    .setSituation(new Map(group[1]))
                    .drawCards();
                }
            }

        /*
            newgroup: {
                number, - id
                fieldsize,
                playerscount
            }
        */
        if ( newgroup ) {
            // create elements to show games
            create_screen_and_game( newgroup.number, newgroup.playerscount, newgroup.fieldsize )
            }

        /*
            deletegroup: {
                number, - id
            }
        */
        if ( deletegroup ) {
            document.getElementById('game-'+deletegroup.number).remove();
            videogames.delete(deletegroup.number);
            }

        };

    // обработчик обрыва сокета - реконнект
    socket.onclose = function(event) {
        // перезагрузить страницу при обрыве связи
        //location.reload(true);
        };
    })

function create_screen_and_game( groupnumber, playerscount, fieldsize ){
    // create elements to show games
    let f = VideoGame.createGameElement(groupnumber);
    VideoGame.createBaseElements(f);   
    document.getElementById('fields').appendChild(f);

    let opts = {
        game                : new TragedyOfCommons(playerscount,fieldsize),
        player              : Array.from({length:playerscount},(_,i)=>i+1),
        gamescreen_element  : f,
        //situation: new Map([ [1,[]], [2,['f2','f3']], [3,['f4','f5','f6']] ])
        }

    let g = new VideoGame(opts);
    videogames.set(groupnumber,g);
    return g;
    }

document.admin_env = { connect, restart, shuffle, videogames }