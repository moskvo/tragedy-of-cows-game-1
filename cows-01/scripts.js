'use strict';

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
    let fieldsize = (n==3) ? 12 : 30;
    let tgame = new TragedyOfCommons(n,fieldsize);
    let opts = {
        game:tgame,
        player:[1,2],
        gamescreen_element:document.querySelector('section.cows-game'),
        //situation: new Map([ [1,[]], [2,['f2','f3']], [3,['f4','f5','f6']] ])
        }
    videogame = new VideoGame(opts);

    let btn = document.getElementById("send");
    btn.onclick = function() {
        videogame.blind.style.visibility = 'visible';
        sendChoice( videogame.situation.get(videogame.player) );
        };
    
    socket = new WebSocket('ws://'+IP+':'+port);
    socket.onopen = (e) => console.log("[open] Соединение установлено")
    // обработчик входящих сообщений
    socket.onmessage = function(event) {
        var incomingMessage = JSON.parse(event.data);
        console.log( incomingMessage );
        if(incomingMessage.HTML){
            videogame.blind.innerHTML = incomingMessage.HTML;
            videogame.blind.style.visibility = incomingMessage.showcontrols?'hidden':'visible';
            return;
            }
        if( incomingMessage.playertype ){
            videogame.setPlayer(incomingMessage.playertype);
            return;
            }
        if( incomingMessage.newround ) {
            videogame.wipeCards();
            videogame.blind.style.visibility = 'hidden';
            videogame.setSituation(new Map(incomingMessage.situation));
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