'use strict';

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
    var outgoingMessage = JSON.stringify({password: document.getElementById('adminPassword').value, shuffle: document.getElementById('shuffle').checked});
    socket.send(outgoingMessage);
    return false;
}

// показать текущее состояние поля в div#field
function showMessage(message) {
    document.getElementById('fields').innerHTML = message;
    }

let videogame;

document.addEventListener("DOMContentLoaded", function(event) {
    document.querySelectorAll('div.cows-game').forEach( cows_game => {
        let fieldsize = (n==3) ? 12 : 30;
        let tgame = new TragedyOfCommons(n,fieldsize);
        let opts = {
            game:tgame,
            player:[1,2],
            gamescreen_element:cows_game,
            //situation: new Map([ [1,[]], [2,['f2','f3']], [3,['f4','f5','f6']] ])
            }
        videogame = new VideoGame(opts);  
        })

    socket = new WebSocket('ws://'+IP+':'+adminport);
    // обработчик входящих сообщений
    socket.onmessage = function(event) {
        var incomingMessage = event.data; 
        //console.log('received message '+incomingMessage);
        //showMessage(incomingMessage); 
        if( incomingMessage.newgame ){
            // create element to show game
        }
    };

    // обработчик обрыва сокета - реконнект
    socket.onclose = function(event) {
        // перезагрузить страницу при обрыве связи
        location.reload(true);
        };
    })