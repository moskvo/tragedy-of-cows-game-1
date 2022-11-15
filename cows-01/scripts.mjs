'use strict';

import { TragedyOfCommons, VideoGame } from "./common.mjs";

if (!window.WebSocket) {
	document.body.innerHTML = 'WebSocket в этом браузере не поддерживается.';
    }

// создать подключение
var socket;
function sendChoice(choice) {
    socket.send(JSON.stringify({choice}));
    }

let videogame;
let game_section;
let blind;

document.addEventListener("DOMContentLoaded", function(event) {    

    game_section = document.querySelector('section.cows-game') // just screen element
    VideoGame.baseElements(game_section);
    blind = game_section.querySelector('.blind');

    socket = new WebSocket('ws://'+IP+':'+port);
    socket.onopen = (e) => console.log("[open] Соединение установлено")

    // обработчик входящих сообщений
    socket.onmessage = function(event) {
        let msg = JSON.parse(event.data);
        console.log( msg );
        if ( msg.HTML ) {
            blind.innerHTML = msg.HTML;
            blind.style.visibility = msg.showcontrols?'hidden':'visible';
            return;
            }
        if( msg.newgame ){
            let tgame = new TragedyOfCommons(msg.n,msg.fieldsize);
            let opts = {
                game:tgame,
                player:msg.playertype,
                gamescreen_element:game_section,
                //situation: new Map([ [1,[]], [2,['f2','f3']], [3,['f4','f5','f6']] ])
                }
            videogame = new VideoGame(opts); // true videogame
            document.videogame = videogame;
        
            document.getElementById("send").onclick = function() {
                videogame.blind.style.visibility = 'visible';
                sendChoice( videogame.situation.get(videogame.player) );
                };
            return;
            }
        if( msg.newround ) {
            console.log('newround');
            videogame.blind.style.visibility = 'hidden';
            videogame.setSituation(new Map(msg.situation));
            //videogame.wipeCards();
            videogame.drawCards();
            videogame.drawPayoff();
            return;
            } 
        if( msg.deletegame ) {
            videogame.choice_set.innerHTML = '';
            videogame.fields.forEach( field => field.remove() );
            videogame = null;
            }
        };
    
    // обработчик обрыва сокета - реконнект
    socket.onclose = function(event) {
        // перезагрузить страницу при обрыве связи
        console.log('socket close, event:'+JSON.stringify(event));
        // uncomment in production
        //location.reload(true); 
        };
    
    });