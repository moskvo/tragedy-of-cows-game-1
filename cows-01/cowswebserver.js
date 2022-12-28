const express = require('express');
const app = express();

const host = 'localhost';
const port = 8080;

app.use(express.static('tragedy-of-cows-game-1/cows-01'));

app.listen(port, host, function () {
	  console.log(`Server listens http://${host}:${port}`);
});
