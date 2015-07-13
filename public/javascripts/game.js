var socket;
var info;

function initSocket() {
	socket = io();
	
	info = {
		name: Math.floor(Math.random() * 1028).toString(16),
		color: "rgb(" + Math.floor(200 * Math.random()) + ", " + Math.floor(200 * Math.random()) + ", " + Math.floor(255 * Math.random()) + ")",//prompt("What is your favorite color?\n(Choose: red, blue, green, yellow, black)")
        x: Math.floor(Math.random() * 200) + 100,
        y: Math.floor(Math.random() * 200) + 100
	};

    socket.on('connect', function() {
        socket.emit('client_info', info);
    });
    
    socket.on("client_info_final", function(data) {
        info = data;
        createBox(info, true);
    });

    socket.on('person_connect', function(data) {
        createBox(data);
    });

    socket.on('person_disconnect', function(data) {
        removeBox(data.name);
    });

	socket.on('server_message', function(data) {
		console.log("Server message: " + data.msg);	
	});

    socket.on('user_count', function(data) {
        document.getElementById("users_online").innerHTML = ".:. " + data.numUsers + (data.numUsers == 1 ? " PLAYER " : " PLAYERS ") + "ONLINE .:.";
    });

	socket.on('update', function(data){
        try {
            document.getElementById(data.name).style.left = data.x + "px";
            document.getElementById(data.name).style.top = data.y + "px";
        }catch(e) {}
	});

    socket.on('force_update', function(data) {
        socket.emit('update', {
            name: info.name,
            x: info.x,
            y: info.y
        });
    });
}

function tick() {
	requestAnimationFrame(tick);
}

function createBox(_info, user) {
	user = user == true;

	var div = document.createElement('div');
	div.style.position = "absolute";
	div.style.width = "50px";
	div.style.height = "50px";
	div.style.backgroundColor = _info.color;
	div.style.marginTop = "-25px";
	div.style.marginLeft = "-25px";
    div.style.cursor = "none";
    div.style.left = _info.x + "px";
    div.style.top = _info.y + "px";
	
	if(user)
		div.id = "user";
	else
		div.id = _info.name;
    div.class = "box";

	document.body.appendChild(div);
}

function removeBox(name) {
	document.body.removeChild(document.getElementById(name));
}

window.addEventListener('mousemove', function(event) {
	lastinfo = {x : info.x, y: info.y};
	
	info.x = event.clientX;
	info.y = event.clientY;
	
	var element = document.getElementById("user");
	if(element) {
		element.style.left = info.x + 'px';
		element.style.top = info.y + 'px';
		
		socket.emit('update', {
            name: info.name,
            x: info.x,
            y: info.y
        });
	}

    document.getElementById("title").style.color = "rgb(" + (255 * Math.random()) + ", " + (255 * Math.random()) + ", " + (255 * Math.random()) + ")";
});

window.onload = function() {
	initSocket();
	tick();
};