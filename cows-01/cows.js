if (!window.WebSocket) {
	document.body.innerHTML = 'WebSocket в этом браузере не поддерживается.';
}

// создать подключение
var socket = new WebSocket('ws://'+IP+':'+port);

x = 0; 

// увеличить число коров на 1
function increase() {
  x = Math.min(x+1,Math.floor(fieldsize*fieldsize));
  sendx();   
};

// уменьшить число коров на 1
function decrease() {
  x = Math.max(x-1,0);
  sendx();  
};

// послать стратегию на сервер
function sendx() {  
  var outgoingMessage = JSON.stringify(x);
  document.getElementById('cows').innerHTML = x.toString();
  socket.send(outgoingMessage);
  // block buttons for 5 seconds
document.getElementById("decrease").disabled = true;
document.getElementById("increase").disabled = true;
setTimeout(function() {document.getElementById("decrease").disabled = false;
document.getElementById("increase").disabled = false;
}, sleeptime);
return false;
};

// обработчик входящих сообщений
socket.onmessage = function(event) {
  var incomingMessage = JSON.parse(event.data);
  if(incomingMessage.HTML!=undefined) {
      showMessage(incomingMessage.HTML);
  }    
  if(incomingMessage.showcontrols) {
      document.getElementById("controls").style.display = 'inline-block';
  } else {
      document.getElementById("controls").style.display = 'none';
  }
  if(incomingMessage.x != undefined) {
      document.getElementById('cows').innerHTML = incomingMessage.x.toString();
      x=incomingMessage.x;
  }
};

// обработчик обрыва сокета - реконнект
socket.onclose = function(event) {
    // перезагрузить страницу при обрыве связи
    location.reload(true);
};

// показать текущее состояние поля в div#field
function showMessage(message) {
  document.getElementById('field').innerHTML = message;
}