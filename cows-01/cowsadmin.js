if (!window.WebSocket) {
     document.body.innerHTML = 'WebSocket в этом браузере не поддерживается.';
}

// создать подключение
var socket = new WebSocket('ws://'+IP+':'+adminport);

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


// обработчик входящих сообщений
socket.onmessage = function(event) {
  var incomingMessage = event.data; 
    //console.log('received message '+incomingMessage);
  showMessage(incomingMessage); 
};

// обработчик обрыва сокета - реконнект
socket.onclose = function(event) {
    // перезагрузить страницу при обрыве связи
    location.reload(true);
};

// показать текущее состояние поля в div#field
function showMessage(message) {
  document.getElementById('fields').innerHTML = message;
}