n = 3; // число игроков

IP = 'localhost';//'85.209.2.180'; // IP адрес сервера
statsport = '8080'; // порт для статистики
port = '8081'; // порт, на котором открывается WebSocket для игроков
adminport = '8082'; // порт, на котором открывается WebSocket для администрирования
updateinterval = 2000; // интервал обновления клиентов (в мс)
historydepth = 100; // глубина истории
sleeptime = 5000; // частота смены стратегии