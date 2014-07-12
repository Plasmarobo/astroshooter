var g_windowSize = 512;
var g_gameWindowId = "game_window";

var g_planetRadius = 64;
var g_planetMass = 1000;
var g_planetImageKey = "PLANET";
var g_gravity = 2;
var g_damping = 10;

var g_numOrbits = 3;

var g_asteroidImageKey = "asteroid";

var g_maxAsteroidSize = 16;
var g_minAsteroidSize = 8;
var g_asteroidMass = 1;

var g_maxAsteroidCount = 20;
var g_minAsteroidCount = 5;

var g_maxStarSize = 5;
var g_minStarSize = 1;

var g_maxStarFlux = 2;
var g_minStarFlux = 0;

var g_minStarBrightness = 200;

var g_orbitalRange = (g_windowSize/2)-g_planetRadius;
var g_orbitWidth = g_orbitalRange/(g_numOrbits+1);

var g_timeScale = 1/10;
var g_maxTimestep = 5*g_timeScale; //ms
var g_gameTime = 0;

var g_astroidColor = "#666666";
var g_planetColor = "#000066";

var g_circleRad = 2*Math.PI;

var g_fps_target = 60;
var g_lastUpdate = (new Date()).getTime();
var g_vectorScale = 5;
var g_debugDrawPhysicsVectors = false;
var g_debugDrawDampingArcs = false;


var g_canvas = 0;
var g_game = 0;
var g_lastMouse = {x: 0, y: 0};

var g_sprites;
var g_assetList = [
	g_planetImageKey,
	g_asteroidImageKey
];

$(document).ready(InitializeGame);

function InitializeGame()
{
	g_canvas = GetCanvas();
	g_sprites = new Object();
	LoadAssets(StartGame);
}

function StartGame()  
{
	(function() {
			var onEachFrame;
			g_game = GenerateSystem();
			if (window.requestAnimationFrame) {
				onEachFrame = function(cb) {
					var _cb = function() { cb(); requestAnimationFrame(_cb); }
					_cb();
				};
			} else if (window.webkitRequestAnimationFrame) {
				onEachFrame = function(cb) {
					var _cb = function() { cb(); webkitRequestAnimationFrame(_cb); }
					_cb();
				};
			} else if (window.mozRequestAnimationFrame) {
				onEachFrame = function(cb) {
					var _cb = function() { cb(); mozRequestAnimationFrame(_cb); }
					_cb();
				};
			} else {
				onEachFrame = function(cb) {
				setInterval(cb, 1000/g_fps_target);
				}
			}
			window.onEachFrame = onEachFrame;
	})();
	window.onEachFrame(RunGame);
	}


function LoadAssets(callback)
{
	var loaders = [];
	for(var i = 0; i < g_assetList.length; ++i)
	{
		loaders.push(LoadSprite(g_assetList[i]));
	}
	$.when.apply(null, loaders).done(function() {StartGame();});
}

function LoadSprite(src) {
	var deferred = $.Deferred();
	var sprite = new Image();
	sprite.onload = function() {
		g_sprites[src] = sprite;
		deferred.resolve();
	};
	sprite.src = "assets/" + src + ".png";
	return deferred.promise();
}

function GetSprite(name)
{
		sprite = g_sprites[name];
		
		return sprite;
}
	
function RunGame()
{
	DrawSystem(g_canvas, g_game);
	UpdateSystem(g_game);
}

function GetCanvas()
{
	var canvas = document.getElementById(g_gameWindowId);
	canvas.onmousemove = function(evt) {
	
			g_lastMouse = (function() {
				var rect = canvas.getBoundingClientRect();
				return {
					x: evt.clientX - rect.left,
					y: evt.clientY - rect.top
					};
				})();
				
			};
	return canvas.getContext("2d");
}

function GenerateOrbitalPosition(orbitIndex)
{
	//Use 0 0 as planet origin, not screen
	//Left bound
	var left = (orbitIndex)*g_orbitWidth+(1.1*g_planetRadius);
	var right = ((orbitIndex)*g_orbitWidth);
	var position = (Math.random()*(right))+left;
	//Select a random starting position
	var starting_angle = Math.random() * 2 * Math.PI;
	return [Math.cos(starting_angle)*position, Math.sin(starting_angle)*position];
}

function GenerateOrbitalVelocity(position, orbitIndex)
{
	//Consider 0 0 planet origin
	var distance = 2*Math.sqrt(Math.pow(position[0],2) + Math.pow(position[1],2));
	var critical_speed = Math.sqrt(g_gravity * g_planetMass / distance);
	var angle = Math.atan2(position[1], position[0]);
	var critical_velocity = [-Math.sin(angle) * (critical_speed), Math.cos(angle) *(critical_speed)];
	return critical_velocity;
	
}

function GenerateAsteroid()
{
	var asteroid =
	{
		size: (Math.random()*(g_maxAsteroidSize-g_minAsteroidSize))+g_minAsteroidSize,
		orbitIndex: Math.floor(Math.random()*g_numOrbits),
		acceleration: [0,0],
		velocity: [0,0],
		position: [0,0],
		mass: g_asteroidMass,
		image: GetSprite(g_asteroidImageKey)
	}
	asteroid.position = GenerateOrbitalPosition(asteroid.orbitIndex);
	asteroid.velocity = GenerateOrbitalVelocity(asteroid.position, asteroid.orbitIndex);
	return asteroid;
}

function GenerateStar()
{
	var star = 
	{
	size: 1,
	position: [0, 0],
	color: [255,255,255],
	flux: 0
	}
	star.position[0] = Math.floor(Math.random()*g_windowSize);
	star.position[1] = Math.floor(Math.random()*g_windowSize);
	star.color[0] = Math.ceil(Math.random()*(255-g_minStarBrightness))+g_minStarBrightness;
	star.color[1] = Math.ceil(Math.random()*(255-g_minStarBrightness))+g_minStarBrightness;
	star.color[2] = Math.ceil(Math.random()*(255-g_minStarBrightness))+g_minStarBrightness;
	star.flux = Math.floor(Math.random()*g_maxStarFlux)+g_minStarFlux;
	return star;
}

function GenerateSystem()
{
	var system =
	{
		size: g_windowSize,
		planet: { 
					radius: g_planetRadius,
					mass: g_planetMass,
					image: GetSprite(g_planetImageKey)
				},
		stars: [],
		asteroids: [],
		ships: []
	}
	var desired_asteroid_count = Math.floor(Math.random()*(g_maxAsteroidCount-g_minAsteroidCount))+g_minAsteroidCount;
	var desired_star_count = Math.floor(Math.random()*100)+5;
	
	while(system.asteroids.length < desired_asteroid_count)
	{
		system.asteroids[system.asteroids.length] = GenerateAsteroid();
	}
	
	while(system.stars.length < desired_star_count)
	{
		system.stars[system.stars.length] = GenerateStar();
	}
	return system;
}

function UpdateSystem(system)
{
	var time_delta = (((new Date()).getTime())-g_lastUpdate)*g_timeScale;
	if (time_delta > g_maxTimestep)
	{
		time_delta = g_maxTimestep;
	}
		g_gameTime += time_delta;
		//Update asteroids
		for(var index = 0; index < system.asteroids.length; ++index)
		{
			asteroid = system.asteroids[index];
		
			var distance = Math.sqrt(Math.pow(asteroid.position[1], 2) + Math.pow(asteroid.position[0], 2));
			var gravity = ( g_gravity * system.planet.mass )/Math.pow(distance, 2);
		
			var x_angle = Math.acos(asteroid.position[0]/distance);
			var y_angle = Math.asin(asteroid.position[1]/distance);
		
			DampVelocityToOrbit(asteroid, time_delta);
	
			asteroid.velocity[0] += asteroid.acceleration[0] * time_delta;
			asteroid.velocity[1] += asteroid.acceleration[1] * time_delta;
		
			asteroid.acceleration[0] = -Math.cos(x_angle) * gravity * time_delta;
			asteroid.acceleration[1] = -Math.sin(y_angle) * gravity * time_delta;
	
		}
	
	
	g_lastUpdate = (new Date()).getTime();
}

function DampVelocityToOrbit(asteroid, time_delta)
{
	//Calculate desired arc
	var distance = Math.sqrt(Math.pow(asteroid.position[0], 2) + Math.pow(asteroid.position[1], 2));
	
	var linear_x = asteroid.position[0] + asteroid.velocity[0] * time_delta;
	var linear_y = asteroid.position[1] + asteroid.velocity[1] * time_delta;
	
	var angle = Math.atan2(asteroid.position[1], asteroid.position[0]);
	var velocity_arc_length = Math.sqrt(Math.pow(asteroid.velocity[0], 2) + Math.pow(asteroid.velocity[1],2))*time_delta;
	
	var projected_angle = angle+(velocity_arc_length)/distance;
	
	var arc_x = Math.cos(projected_angle) * distance;
	var arc_y = Math.sin(projected_angle) * distance;
	
	if(g_debugDrawDampingArcs)
	{
		g_canvas.beginPath();
		g_canvas.strokeStyle = "#FF0000";
		g_canvas.arc(linear_x + g_windowSize/2, linear_y + g_windowSize/2, 3, 0, g_circleRad);
		g_canvas.stroke();
		g_canvas.beginPath();
		g_canvas.arc(g_windowSize/2, g_windowSize/2, distance, 0, projected_angle);
		g_canvas.stroke();
		g_canvas.beginPath();
		g_canvas.strokeStyle = "#00FF00";
		g_canvas.arc(arc_x + g_windowSize/2, arc_y + g_windowSize/2, 3, 0, g_circleRad);
		g_canvas.stroke();
		g_canvas.beginPath();
		g_canvas.arc(g_windowSize/2, g_windowSize/2, distance-1, 0, angle);
		g_canvas.stroke();	
	}
	
	var linear_error = Math.abs(linear_x) - Math.abs(arc_x) + Math.abs(linear_y) - Math.abs(arc_y);
	
	if ( linear_error < (g_damping * g_timeScale))
	{
		asteroid.velocity[0] = arc_x - asteroid.position[0];
		asteroid.velocity[1] = arc_y - asteroid.position[1];
		asteroid.position[0] = arc_x;
		asteroid.position[1] = arc_y;
		
	}else{
		asteroid.position[0] = linear_x;
		asteroid.position[1] = linear_y;
	}
	
}

function ClearCanvas(canvas)
{
	canvas.fillStyle="#000000";
	canvas.fillRect(0,0,g_windowSize, g_windowSize);
}

function DrawSystem(canvas, system)
{
	ClearCanvas(canvas);
	for(var index = 0; index < system.stars.length; ++index)
	{
		star = system.stars[index];
		DrawStar(canvas, star);
	}
	DrawPlanet(canvas, system.planet);
	for(var index = 0; index < system.asteroids.length; ++index)
	{
		asteroid = system.asteroids[index];
		DrawAsteroid(canvas, asteroid);
	}
	//DrawCursor(canvas, g_lastMouse);
}

function DrawStar(canvas, star)
{
	//No coordinate translation required
	canvas.fillStyle = "rgb(" + star.color[0] + "," + star.color[1] + "," + star.color[2] + ")";
	canvas.beginPath();
	canvas.arc(star.position[0], star.position[1], star.size, 0, g_circleRad);
	canvas.fill();
}

function DrawAsteroid(canvas, asteroid)
{
	//Move asteroids into screenspace
	if(asteroid.image)
	{
		canvas.drawImage(asteroid.image, asteroid.position[0] - asteroid.size + g_windowSize/2, asteroid.position[1] - asteroid.size + g_windowSize/2, asteroid.size, asteroid.size);
	}else{
		canvas.fillStyle = g_astroidColor;
		canvas.beginPath();
		canvas.strokeStyle = "#000000";
		canvas.arc(asteroid.position[0]+(g_windowSize/2), asteroid.position[1]+(g_windowSize/2), asteroid.size, 0, g_circleRad);
		canvas.fill();
	}
	if(g_debugDrawPhysicsVectors)
	{
		canvas.beginPath();
		canvas.strokeStyle = "#FF0000";
		canvas.moveTo(asteroid.position[0]+g_windowSize/2, asteroid.position[1]+g_windowSize/2);
		canvas.lineTo(asteroid.position[0]+(g_windowSize/2)+asteroid.velocity[0]*(g_vectorScale/g_timeScale), asteroid.position[1]+(g_windowSize/2)+asteroid.velocity[1]*(g_vectorScale/g_timeScale));
		canvas.stroke();
		canvas.beginPath();
		canvas.strokeStyle = "#00FF00";
		canvas.moveTo(asteroid.position[0]+(g_windowSize/2), asteroid.position[1]+(g_windowSize/2));
		canvas.lineTo(asteroid.position[0]+(g_windowSize/2)+asteroid.acceleration[0]*(g_vectorScale/g_timeScale), asteroid.position[1]+(g_windowSize/2)+asteroid.acceleration[1]*(g_vectorScale/g_timeScale));
		canvas.stroke();
	}
}

function DrawPlanet(canvas, planet)
{
	if(planet.image)
	{
		canvas.drawImage(planet.image, g_windowSize/2 - g_planetRadius, g_windowSize/2-g_planetRadius );
	}else{
		canvas.fillStyle = g_planetColor;
		canvas.beginPath();
		canvas.arc(g_windowSize/2, g_windowSize/2, planet.radius,0, g_circleRad);
		canvas.fill();
	}
}



function DrawCursor(canvas, coordinates)
{
	canvas.beginPath();
	canvas.strokeStyle = "#0000FF";
	canvas.moveTo(g_windowSize/2, g_windowSize/2);
	canvas.lineTo(coordinates.x, coordinates.y);
	canvas.stroke();
	
	var x = coordinates.x-(g_windowSize/2);
	var y = coordinates.y-(g_windowSize/2);
	var distance = Math.sqrt(Math.pow(x,2) + Math.pow(y,2));
	
	var x_angle = Math.acos(x/distance);
	var y_angle = Math.asin(y/distance);
	
	var x_term = -Math.sin(y_angle)*55;
	var y_term = Math.cos(x_angle)*55;
	
	canvas.beginPath();
	canvas.strokeStyle = "#FF0000";
	canvas.moveTo(coordinates.x, coordinates.y);
	canvas.lineTo(coordinates.x - x_term, coordinates.y - y_term);
	canvas.stroke();
	canvas.fillStyle = "#FFFFFF";
	canvas.font="20px Georgia";
	//canvas.fillText(Math.sin(x_angle),coordinates.x,coordinates.y);
	//canvas.fillText(Math.cos(x_angle),coordinates.x,coordinates.y+21);
	
}
