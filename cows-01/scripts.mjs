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

document.addEventListener("DOMContentLoaded", function(event) {    

    videogame = document.querySelector('section.cows-game') // just screen element
    VideoGame.baseElements(videogame);
    videogame.blind = videogame.querySelector('.blind');

    socket = new WebSocket('ws://'+IP+':'+port);
    socket.onopen = (e) => console.log("[open] Соединение установлено")

    // обработчик входящих сообщений
    socket.onmessage = function(event) {
        var msg = JSON.parse(event.data);
        console.log( msg );
        if ( msg.HTML ) {
            videogame.blind.innerHTML = msg.HTML;
            videogame.blind.style.visibility = msg.showcontrols?'hidden':'visible';
            return;
            }
        if( msg.playertype ){
            let tgame = new TragedyOfCommons(msg.n,msg.fieldsize);
            let opts = {
                game:tgame,
                player:msg.playertype,
                gamescreen_element:videogame,
                //situation: new Map([ [1,[]], [2,['f2','f3']], [3,['f4','f5','f6']] ])
                }
            videogame = new VideoGame(opts); // true videogame
            document.videogame = videogame;
        
            let btn = document.getElementById("send");
            btn.onclick = function() {
                videogame.blind.style.visibility = 'visible';
                sendChoice( videogame.situation.get(videogame.player) );
                };
            return;
            }
        if( msg.newround ) {
            videogame.blind.style.visibility = 'hidden';
            videogame.setSituation(new Map(msg.situation));
            //videogame.wipeCards();
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