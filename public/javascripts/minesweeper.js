/* FINAL VARIABLES */
var COVERED		= 'covered';
var UNCOVERED 	= 'uncovered';
var FLAGGED 	= 'flagged';
var QUESTION 	= 'question';
var colors      = [ '#B63030', '#FF7F44', '#FFFF44', '#44FF44', '#2222FF', '#44FFFF', '#FC87FF', '#6C3002' ];
var sheet = loadImage("../images/art.png"); // Image
var tileSize = 16;  // Size of each tile in pixels
/* */

/* DOM ELEMENTS */
var toolbar;
var bombCount;
var resetButton;
var timer; 	
var hostPlayerName;
var onlinePlayerNames;
var messageInput;
/* */

/* INPUT VARIABLES */
var mouse = {x : -1, y : -1};
var downTile = {x: -1, y: -1};
var dragStart = {x: -1, y: -1};
var mouseLeft = false;
var mouseRight = false;
var dragging = false;
/* */

/* RENDERING VARIABLES */
var canvas;
var ctx;

var canvasPercent = 0.75; // Percent of window size
var canvasMinSize = 256;
var canvasMaxSize = 1028;

var viewOffsX = 0;
var viewOffsY = 0;
/* */

/* GAME VARIABLES */
var startTime; // Int
var endTime; // Int

var board; // Array of bombs
var boardGenerated; // Boolean

var hitBomb; // {x, y}

var numTiles = 28;
var numBombs = 160;
var unflagged;

var game_state; // { game_over (Bool), details (String) }
/* */

/* IO VARIABLES */
var socket;
var player;
var players = [];
/* */


//-----------------------------------------------


/* 
	INITIALIZATION FUNCTIONS
*/
var pageLoaded = false;
$(function() { pageLoaded = true; init(); });

var imagesToLoad = 0;
function loadImage(path) {
	var res = new Image();
	imagesToLoad++;
	res.onload = function() {
		imagesToLoad--;
		if(imagesToLoad == 0)
			init();
	}
	res.src = path;
	return res;
}

function init() {
	if(!pageLoaded || imagesToLoad > 0) return;

	socket = io();

	canvas = document.getElementById("game_screen");
	canvas.addEventListener('mousemove', _mouseMove);
	canvas.addEventListener('mousedown', _mouseDown);
	canvas.addEventListener('mouseup', _mouseUp);
	canvas.addEventListener('mouseout', _mouseOut);
	
	ctx = canvas.getContext("2d");
	ctx.imageSmoothingEnabled = false;
	ctx.mozImageSmoothingEnabled = false;
	ctx.webkitImageSmoothingEnabled = false;
	ctx.msImageSmoothingEnabled = false;
	ctx.setTransform(4, 0, 0, 4, 8, 0);
	ctx.fillStyle="black"; // clear color
	
	toolbar = document.getElementById("toolbar");
	
	bombCount = document.getElementById("bomb-count");

	resetButton = document.getElementById("reset-button");
	resetButton.addEventListener('mousedown', function() {
		if(player.host)
			sendReset();
	});
	
	timer = document.getElementById("timer");

	messageInput = document.getElementById("message_input");
	messageInput.addEventListener('keydown', function(event) {
		if(event.which == 13) {
			var msg = messageInput.value.trim();
			if(msg.length == 0)
				return;
			sendMessage(msg);
			messageInput.value="";
		}
	});

	onlinePlayerNames = document.getElementById("players_online");
	hostPlayerName = document.getElementById("host");

	initGame();

	var color = Math.floor(Math.random() * 8);
	var name = Math.floor(Math.random() * 0xffffff).toString(16);//color_names[color];
	player = {
		name: name,
		color: color
	};
	initSocketListeners();
	
	tick();
}
/*
*/

/* 
	ENGINE FUNCTIONS 
*/
function tick() {
	requestAnimationFrame(tick);
	updateCanvas();
	update();
	render();
}

function updateCanvas() {
	var windowWidth = window.innerWidth;
	var windowHeight = window.innerHeight;
	
	var cw = windowWidth * canvasPercent;
	cw = Math.max(Math.min(cw, canvasMaxSize), canvasMinSize);
	
	var ch = windowHeight * canvasPercent;
	ch = Math.max(Math.min(ch, canvasMaxSize), canvasMinSize);
	
	var cs = Math.min(cw, ch);
	cd = Math.floor(cs - (cs % 2));
	
	canvas.width = cs;
	canvas.height = cs;
	toolbar.style.width = (canvas.width + 2) + "px";
}

function getZoom() {
	//var scale = Math.max(Math.floor(canvas.width / (numTiles * tileSize)), 1); // Floored scaling, possibly no artifacts
	var scale = Math.max(Math.ceil(canvas.width / (numTiles * tileSize)), 1); // Basic scaling, floating point, creates artifacts
	//console.log(scale);
	return 1.25;
}
/*
*/

/* 
	INPUT FUNCTIONS 
*/
function getMousePos(e) {
	var rect = canvas.getBoundingClientRect();
	return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function _mouseMove(event) { mouse = getMousePos(event); }

function _mouseOut(event) {
	mouse = { x: -1, y: -1 };
	checkForPositionUpdate();
	mouseLeft = false;
	mouseRight = false;
}

function _mouseDown(event) {
	mouse = getMousePos(event);

	var _mouse = toTileCoords(mouse.x, mouse.y);

	if(event.button == 0) {
		mouseLeft = true;
		downTile = { x : _mouse.x, y : _mouse.y };
		if(boardGenerated || player.host) {
			leftClickTile(_mouse, true);
			sendClick(true, true, _mouse.x, _mouse.y);
		}
	}

	if(event.button == 2) {
		mouseRight = true;
		if(boardGenerated || player.host) {
			rightClickTile(_mouse, true);
			sendClick(false, true, _mouse.x, _mouse.y);
		}
	}

	return false;
}

function _mouseUp(event) {
	mouse = getMousePos(event);
	
	var _mouse = toTileCoords(mouse.x, mouse.y);

	if(event.button == 0) { // Left up
		mouseLeft = false;
		downTile = { x : -1, y : -1 };
		if(boardGenerated || player.host) {
			if(!dragging) {
				leftClickTile(_mouse, false);
				sendClick(true, false, _mouse.x, _mouse.y);
			}
		}
	}

	if(event.button == 2) { // Right up
		mouseRight = false;
		if(boardGenerated || player.host) {
			rightClickTile(_mouse, false);
			sendClick(false, false, _mouse.x, _mouse.y);
		}
	}

	if(dragging)
		dragging = false;
		
	return false;
}

function leftClickTile(coord, mouseDown) {
	mouseDown = mouseDown == true;
	if(game_state.game_over || !tileValid(coord))
		return;

	var _tile = board[coord.x + coord.y * numTiles];
	
	if(_tile.state == UNCOVERED) {
		if(mouseDown) {
			if(_tile.bombsAdj == numAdjFlagged(coord.x, coord.y) && !_tile.isBomb)
				uncoverSurroundingTiles(coord.x, coord.y);
		}
	} else if(_tile.state == COVERED) {
		if(!mouseDown) {
			if(!boardGenerated) {
				generateBoard(coord.x, coord.y);
				uncoverTile(coord.x, coord.y);
				broadcastBoard();
			} else {
				uncoverTile(coord.x, coord.y);
			}
			_tile.down = false;
		} else {
			_tile.down = true;
		}
	} else if(_tile.state == FLAGGED) {
		if(mouseDown) {
			_tile.state = QUESTION;
			unflagged++;
		}
	} else if(_tile.state == QUESTION) {
		if(mouseDown) {
			_tile.down = true;
		} else if(_tile.down) {
			_tile.down = false;
			_tile.state = COVERED;
			uncoverTile(coord.x, coord.y);
		}
	}
}

function rightClickTile(coord, mouseDown) {
	mouseDown = mouseDown == true;
	if(game_state.game_over || !tileValid(coord) || !boardGenerated)
		return;

	var _index = coord.x + coord.y * numTiles;
	var _tile = board[_index];

	// TODO: Add question mark tiles
	if(_tile.state == COVERED || _tile.state == FLAGGED || _tile.state == QUESTION) {
		if(mouseDown) {
			_tile.state = _tile.state == FLAGGED ? COVERED : FLAGGED;
			unflagged += _tile.state == FLAGGED ? -1 : 1;
		}
	}
}
/*
*/

/* GAME FUNCTIONS */
function initGame() {
	game_state = { game_over: false, details: "", bombsUncovered: false };
	startTime = -1;
	endTime = -1;
	unflagged = -1;
	hitBomb = {x: -1, y: -1};
	timer.innerHTML = "000";
	timesUp = false;
	document.getElementById("toolbar").style.color = "white";
	initBoard();
}

function initBoard() {
	board = new Array();
	for(var i = 0; i < numTiles * numTiles; i++) { 
		board[i] = {
			isBomb: false,
			state: COVERED,
			bombsAdj: 0,
			down: false,
			correct: false
		};
	}
	boardGenerated = false;

}

function generateBoard(ix, iy) {
	if(boardGenerated)
		return;

	for(var bombIndex = 0; bombIndex < numBombs; bombIndex++) {

		var i = Math.floor(Math.random() * numTiles * numTiles);
		var x = i % numTiles;
		var y = Math.floor(i / numTiles);
		
		if(Math.abs(x - ix) <= 1 && Math.abs(y - iy) <= 1) continue;
		board[i].isBomb = true;

	}

	// Load adjacent bomb numbers
	for(var i=0;i<numTiles;i++) {
	for(var j=0; j<numTiles;j++) { 
	var index=i+j*numTiles;
	for(var _i=-1;_i<=1;_i++) {
	for(var _j=-1;_j<=1;_j++) {
	if(_i==0&&_j==0)continue;
	var __i=_i+i; var __j=_j+j;
	if(__i<0||__i>=numTiles||__j<0||__j>=numTiles)continue;
	board[index].bombsAdj+=board[__i+__j*numTiles].isBomb?1:0;
	}}}}

	unflagged = numBombs;
	boardGenerated = true;
	startTime = new Date().getTime();
}

function tileValid(tile) { return tile.x >= 0 && tile.y >= 0 && tile.x < numTiles && tile.y < numTiles; }

function numAdjFlagged(i, j) {
	var numFlagged = 0;
	var index = i + j * numTiles;
	for(var _i = -1; _i <= 1; _i++) {
		for(var _j = -1; _j <= 1; _j++) {
			if(_i == 0 && _j == 0)
				continue;
			var __i = _i + i;
			var __j = _j + j;
			if(__i < 0 || __i >= numTiles || __j < 0 || __j >= numTiles)
				continue;
			numFlagged += board[__i + __j * numTiles].state == FLAGGED ? 1 : 0;
		}
	}
	return numFlagged;
}

// Pixel point to tile coordinates
function toTileCoords(x, y) {
	var scale = getZoom();
	var boardSize = numTiles * tileSize * scale;
	var centerOffsX = (canvas.width / 2 - boardSize / 2);
	var centerOffsY = (canvas.height / 2 - boardSize / 2);
	
	var tileOffsX = centerOffsX + viewOffsX;
	tileOffsX = tileOffsX > 0 ? 0 : tileOffsX;
	tileOffsX = centerOffsX > 0 ? centerOffsX : tileOffsX;
	var tileOffsY = centerOffsY + viewOffsY;
	tileOffsY = tileOffsY > 0 ? 0 : tileOffsY;
	tileOffsY = centerOffsY > 0 ? centerOffsY : tileOffsY;

	return {
		x: Math.floor(((x - tileOffsX) / scale ) / tileSize),
		y: Math.floor(((y - tileOffsY) / scale) / tileSize)
	};
}

// For the sprite sheet
function numToSheetCoords(num) { 
	if(num == 0)
		return { x: 3, y: 0 }; // Empty tile
	num--;
	return { x: (num % 4) + 0, y: Math.floor(num / 4) + 3 };
}

function uncoverTile(i, j) {
	var _tile = board[i + j * numTiles];
	if(_tile.state == UNCOVERED)
		return;

	if(_tile.state == COVERED) {
		_tile.state = UNCOVERED;

		if(_tile.bombsAdj == 0 && !_tile.isBomb) {
			uncoverSurroundingTiles(i, j);
		}
		if(_tile.isBomb) {
			if(hitBomb.x == -1 && hitBomb.y == -1) {
				hitBomb = { x: i, y: j };
				game_state.game_over = true;
				game_state.details = "bomb_found";
				uncoverAllBombs();
			}
		}
	}
	/*
	else
		_downTile.state = QUESTION;
	*/
}

function uncoverSurroundingTiles(i, j) {
	for(var _i = -1; _i <= 1; _i++) {
		for(var _j = -1; _j <= 1; _j++) {
			if(_i == 0 && _j == 0)
				continue;
			var __i = _i + i;
			var __j = _j + j;
			if(__i < 0 || __i >= numTiles || __j < 0 || __j >= numTiles)
				continue;
			if(board[__i + __j * numTiles].state != UNCOVERED)
				uncoverTile(__i, __j);
		}
	}
}

function uncoverAllBombs() {
	if(game_state.bombsUncovered)
		return;
	game_state.bombsUncovered = true;
	for(var i = 0; i < numTiles * numTiles; i++) {
		if(board[i].isBomb) {
			if(board[i].state == FLAGGED)
				board[i].correct = true;
			board[i].state = UNCOVERED;
		}
	}
	printGameOver();
}

function printGameOver(quiet) {
	quiet = quiet == true;
	if(!quiet)
		printMessage("<span style='font-weight:bold;color:#CC2222;'>GAME OVER!</span>");
	if(!player.host) {
		printMessage("<span style='font-weight:bold;'>Waiting for the host to restart the game...</span>");
	} else {
		printMessage("<span style='font-weight:bold;'>Press the refresh button in the middle of the toolbar to restart the game.</span>");
	}
}

function printStartGame() {
	if(!player.host) {
		printMessage("<span style='font-weight:bold;'>Waiting for host to start the game...</span>");
	} else {
		printMessage("<span style='font-weight:bold;'>Click a tile to start the game!</span>");
	}
}

function releaseTile(x, y) {
	if(!tileValid({x: x, y: y}))
		return;
	board[x + y * numTiles].down = false;
}

function updateTimer() {
	var time = endTime != -1 ? endTime : new Date().getTime();
	var elapsed = Math.floor((time - startTime) / 1000);
	elapsed = elapsed > 999 ? 999 : elapsed;
	if(elapsed == 999) {
		game_state.game_over = true;
		game_state.details = "times_up";
		uncoverAllBombs();
	}
	timer.innerHTML = Math.floor(elapsed / 100) + "" + (Math.floor((elapsed % 100) / 10)) + "" + (elapsed % 10);
}

function update() {
	var _mouse = toTileCoords(mouse.x, mouse.y);
	
	if(mouseLeft && tileValid(downTile)) {
		if(_mouse.x != downTile.x || _mouse.y != downTile.y) {
			releaseTile(downTile.x, downTile.y);
			sendTileRelease(downTile.x, downTile.y);
			downTile = { x: -1, y: -1};
			startDrag = { x: mouse.x, y: mouse.y };
			dragging = true;
		}
	}

	if(dragging) {
		viewOffsX = mouse.x - startDrag.x;
		viewOffsY = mouse.y - startDrag.y;
	}

	//console.log(dragging);

	if(!boardGenerated)
		bombCount.innerHTML = "??";
	else if(parseInt(bombCount.innerHTML) != unflagged)
		bombCount.innerHTML = unflagged + "";

	if(game_state.game_over && endTime == -1)
		endTime = new Date().getTime();

	if(startTime != -1 && !game_state.game_over)
		updateTimer();

	if(game_state.game_over) {
		document.getElementById("toolbar").style.color = "#f33";
	}

	checkForPositionUpdate();
}

function render() {
	var scale = getZoom();

	ctx = canvas.getContext("2d");
	ctx.imageSmoothingEnabled = false;
	ctx.mozImageSmoothingEnabled = false;
	ctx.webkitImageSmoothingEnabled = false;
	ctx.msImageSmoothingEnabled = false;
	ctx.setTransform(scale, 0, 0, scale, 0, 0);
	
	var boardSize = Math.floor(numTiles * tileSize * scale);
	var centerOffsX = Math.floor((canvas.width / 2 - boardSize / 2) / scale);
	var centerOffsY = Math.floor((canvas.height / 2 - boardSize / 2) / scale);

	var tileOffsX = centerOffsX + viewOffsX;
	tileOffsX = tileOffsX > 0 ? 0 : tileOffsX;
	tileOffsX = centerOffsX > 0 ? centerOffsX : tileOffsX;

	var tileOffsY = centerOffsY + viewOffsY;
	tileOffsY = tileOffsY > 0 ? 0 : tileOffsY;
	tileOffsY = centerOffsY > 0 ? centerOffsY : tileOffsY;

	var _mouse = toTileCoords(mouse.x, mouse.y);

	for(var i = 0; i < numTiles; i++) {
		for(var j = 0; j < numTiles; j++) {
			var _i = i * tileSize + tileOffsX;
			var _j = j * tileSize + tileOffsY;
			var index = i + j * numTiles;
			var tile = board[index];
			
			switch(tile.state) {
				case COVERED:
					if(tile.down)
						ctx.drawImage(sheet, tileSize * 1, tileSize * 0, tileSize, tileSize, _i, _j, tileSize, tileSize);
					else
						ctx.drawImage(sheet, tileSize * 0, tileSize * 0, tileSize, tileSize, _i, _j, tileSize, tileSize);
				break;
				case UNCOVERED:
					if(board[index].isBomb) {
						if((hitBomb.x == i && hitBomb.y == j) || game_state.details == "times_up")
							ctx.drawImage(sheet, tileSize * 3, tileSize * 3, tileSize, tileSize, _i, _j, tileSize, tileSize);
						else if(game_state.game_over && tile.correct)
							ctx.drawImage(sheet, tileSize * 4, tileSize * 3, tileSize, tileSize, _i, _j, tileSize, tileSize);
						else
							ctx.drawImage(sheet, tileSize * 0, tileSize * 3, tileSize, tileSize, _i, _j, tileSize, tileSize);
					} else {
						var badj = board[index].bombsAdj;
						if(badj == 0) {
							ctx.drawImage(sheet, tileSize * 3, tileSize * 0, tileSize, tileSize, _i, _j, tileSize, tileSize);
						} else {
							ctx.drawImage(sheet, tileSize * (board[index].bombsAdj - 1), tileSize * 2, tileSize, tileSize, _i, _j, tileSize, tileSize);
						}
					}
				break;
				case FLAGGED:
					if(game_state.game_over && !tile.correct)
						ctx.drawImage(sheet, tileSize * 5, tileSize * 0, tileSize, tileSize, _i, _j, tileSize, tileSize);
					else
						ctx.drawImage(sheet, tileSize * 4, tileSize * 0, tileSize, tileSize, _i, _j, tileSize, tileSize);
				break;
				case QUESTION:
					if(game_state.game_over && !tile.correct)
						ctx.drawImage(sheet, tileSize * 7, tileSize * 0, tileSize, tileSize, _i, _j, tileSize, tileSize);
					else if(tile.down)
						ctx.drawImage(sheet, tileSize * 1, tileSize * 0, tileSize, tileSize, _i, _j, tileSize, tileSize);
					else
						ctx.drawImage(sheet, tileSize * 6, tileSize * 0, tileSize, tileSize, _i, _j, tileSize, tileSize);					
				break;
			}
			
			for(var k = 0; k < players.length; k++) {
				var p = players[k];
				if(i == p.x && j == p.y)
					ctx.drawImage(sheet, tileSize * p.color, tileSize * 1, tileSize, tileSize, _i, _j, tileSize, tileSize);	
			}
			
			if(i == _mouse.x && j == _mouse.y)
				ctx.drawImage(sheet, tileSize * player.color, tileSize * 1, tileSize, tileSize, _i, _j, tileSize, tileSize);
		}
	}
}

/* IO FUNCTIONS */
function sendClientData() {
	socket.emit("client_info", player);
}

function finalizeClientData(data) {
	player = data;
	printMessage("Welcome, you are " + getNameHTML(player.name, player.color));
	if(player.host) {
		printMessage("You are the host.");
		updateHost(player);
		$("#reset-button").removeClass("disabled");
	} else {
		$("#reset-button").addClass("disabled");
	}
}

function printMessage(message) {
	$("#message_board").append(message + "<hr />");
	var mboard = document.getElementById("message_board");
	mboard.scrollTop = mboard.scrollHeight;
}

function getNameHTML(name, index, stacked) {
	stacked = stacked == true;
	return "<span class='name" + (stacked ? " stacked" : "") + (name == player.name ? " user" : "") + "' style='color: " + colors[index] + "'>" + name + "</span>";
}

var last_mouse = { x: -1, y: -1 };
function checkForPositionUpdate() {
	var _mouse = toTileCoords(mouse.x, mouse.y);
	if(_mouse.x == last_mouse.x && _mouse.y == last_mouse.y)
		return;
	last_mouse = {x: _mouse.x, y: _mouse.y};
	sendUpdate();
}

function sendUpdate() {
	var _mouse = toTileCoords(mouse.x, mouse.y);
	socket.emit("update", {
		_type: "position",
		x: _mouse.x,
		y: _mouse.y
	});
}

function sendClick(left, mouseDown, x, y) {
	socket.emit("update", {
		_type: "click",
		left: left,
		down: mouseDown,
		x: x,
		y: y
	});
}

function onUpdate(data) {
	switch(data._type) {
		case "position":
		updatePosition(data);
		break;
		case "click":
		onClick(data);
		break;
		case "tile_release":
		releaseTile(data.x, data.y);
		break;
	}
}

function sendTileRelease(x, y) {
	socket.emit('update', {
		_type: 'tile_release',
		x: x,
		y: y
	});
}

function updatePosition(data) {
	for(var i = 0; i < players.length; i++) {
		if(players[i].id == data.id) {
			players[i].x = data.x;
			players[i].y = data.y;
		}
	}
}

function onClick(data) {
	if(data.left == true) {
		leftClickTile({x:data.x, y:data.y}, data.down);
	} else {
		rightClickTile({x:data.x, y:data.y}, data.down);
	}
}

function newPlayer(data) {
	players.push(data);
	if(player.host && boardGenerated)
		sendBoard(data.id);
	var connectionMessage = "Player " + getNameHTML(data.name, data.color) + "  is connected.";
	printMessage(connectionMessage);
	updatePlayerNames();
}

function deletePlayer(data) {
	for(var i = 0; i < players.length; i++) {
		if(players[i].id == data.id) {
			players.splice(i, 1);
		}
	}
	var connectionMessage = "Player " + getNameHTML(data.name, data.color) + "  has disconnected.";
	printMessage(connectionMessage);
	updatePlayerNames();
}

function setBoard(data) {
	console.log("Setting board...");
	board = data.tiles;
	startTime = data.startTime;
	endTime = data.endTime;
	numBombs = data.numBombs;
	unflagged = numBombs;
	numTiles = data.numTiles;
	boardGenerated = true;
	game_state = data.game_state;
	hitBomb = data.hitBomb;
	updateTimer();
	if(endTime != -1) {
		printGameOver();
	} else if(startTime == -1) {
		printStartGame();
	}
}

function resetGame() {
	initGame();
}

function sendReset() {
	socket.emit('game_reset');
}

function sendBoard(playerID) {
	var dat = getBoardData();
	console.log(dat);
	dat.dest = playerID;
	socket.emit("board_data", dat);
}

function broadcastBoard() {
	socket.emit('init_board_data', getBoardData());
}

function getBoardData() {
	return {
		tiles: board,
		startTime: startTime,
		endTime: endTime,
		boardGenerated: boardGenerated,
		numBombs: numBombs,
		numTiles: numTiles,
		hitBomb: hitBomb,
		game_state: game_state
	};
}

function becomeHost() {
	player.host = true;
	$("#reset-button").removeClass("disabled");
	printMessage("You are the new host.");
	/*
	if(endTime != -1) {
		printGameOver(true);
	} else if(startTime == -1) {
		printStartGame();
	}*/
}

function sendMessage(message) {
	message = message.replace(/</g, "&lt;");
	message = message.replace(/>/g, "&gt;");
	socket.emit('send_message', {
		name: player.name,
		color: player.color,
		message: message
	});
}

function displayMessage(data) {
	printMessage(getNameHTML(data.name, data.color) + ": " + data.message);
}

function updatePlayerNames() {
	onlinePlayerNames.innerHTML = "";
	var result = getNameHTML(player.name, player.color, true);
	for(var i = 0; i < players.length; i++) {
		result += getNameHTML(players[i].name, players[i].color, true);
	}
	onlinePlayerNames.innerHTML = result;
}

function updateHost(data) {
	hostPlayerName.innerHTML = getNameHTML(data.name, data.color, true);
}

function initSocketListeners() {
	socket.on("update", onUpdate);
	socket.on("client_info_final", finalizeClientData);
	socket.on("person_connect", newPlayer);
	socket.on("person_disconnect", deletePlayer);
	socket.on("force_update", sendUpdate);
	socket.on("board_data", setBoard);
	socket.on('connect', sendClientData);
	socket.on('become_host', becomeHost);
	socket.on('set_host', updateHost);
	socket.on('game_reset', resetGame);
	socket.on('message', displayMessage);

}