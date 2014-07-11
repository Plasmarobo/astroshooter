var g_windowSize = 512;
var g_gameWindowId = "game_window";

var g_planetRadius = 64;
var g_planetGravity = 2;
var g_planetMass = 100;

var g_numOrbits = 3;

var g_maxAsteroidSize = 16;
var g_minAsteroidSize = 8;

var g_maxAsteroidCount = 15;
var g_minAsteroidCount = 5;

var g_maxStarSize = 5;
var g_minStarSize = 1;

var g_maxStarFlux = 2;
var g_minStarFlux = 0;

var g_minStarBrightness = 200;

var g_orbitalRange = (g_windowSize/2)-g_planetRadius;
var g_orbitWidth = g_orbitalRange/(g_numOrbits+1);

var g_minTimestep = 100; //ms

var g_astroidColor = "#666666";
var g_planetColor = "#000066";

var g_circleRad = 2*Math.PI;

var g_fps_target = 60;
var g_lastUpdate = (new Date()).getTime();

var g_canvas = 0;
var g_game = 0;

window.onload = function(){
	(function() {
		var onEachFrame;
		g_canvas = GetCanvas();
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
};

function RunGame()
{
	DrawSystem(g_canvas, g_game);
	UpdateSystem(g_game);
}

function GetCanvas()
{
	var canvas = document.getElementById(g_gameWindowId);
	return canvas.getContext("2d");
}

function GenerateOrbitalPosition(orbitIndex)
{
	//Use 0 0 as planet origin, not screen
	//Left bound
	var left = (orbitIndex+1)*g_orbitWidth;
	var right = ((orbitIndex+1)*g_orbitWidth) + g_orbitWidth;
	var position = (Math.random()*(right-left))+left;
	//Select a random starting position
	var starting_angle = Math.random() * 2 * Math.PI;
	return [Math.cos(starting_angle)*position, Math.sin(starting_angle)*position];
}

function GenerateOrbitalVelocity(position, orbitIndex)
{
	//Consider 0 0 planet origin
	var distance = Math.sqrt(Math.pow(position[0],2) + Math.pow(position[1],2));
	var critical_speed = 5*Math.sqrt( (g_planetMass*g_planetGravity) / distance);
	var x_angle = Math.acos(position[0]/distance);
	var y_angle = Math.asin(position[1]/distance);
	var critical_velocity = [-Math.sin(x_angle) * (critical_speed), Math.cos(y_angle) *(critical_speed)];
	return critical_velocity;
	//return orbitIndex%2 ? critical_velocity : -critical_velocity;
}

function GenerateAsteroid()
{
	var asteroid =
	{
		size: (Math.random()*(g_maxAsteroidSize-g_minAsteroidSize))+g_minAsteroidSize,
		orbitIndex: Math.floor(Math.random()*g_numOrbits),
		acceleration: [0,0],
		velocity: [0,0],
		position: [0,0]
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
					gravity: g_planetGravity
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
	var time_delta = ((new Date()).getTime())-g_lastUpdate;
	var time_steps = time_delta/g_minTimestep;
	
	while(time_steps > 0)
	{
		var time_slice = 0;
		if(time_steps > 1)
		{
			time_slice = 1;
			time_steps -= 1;
		}else{
			time_slice = time_steps;
			time_steps = 0;
		}
		//Update asteroids
		for(var index = 0; index < system.asteroids.length; ++index)
		{
			asteroid = system.asteroids[index];
			asteroid.position[0] += asteroid.velocity[0] * time_slice;
			asteroid.position[1] += asteroid.velocity[1] * time_slice;
			asteroid.velocity[0] += asteroid.acceleration[0] * time_slice;
			asteroid.velocity[1] += asteroid.acceleration[1] * time_slice;
			var distance = Math.sqrt(Math.pow(asteroid.position[1], 2) + Math.pow(asteroid.position[0], 2));
			var x_angle = Math.acos(asteroid.position[0]/distance);
			var y_angle = Math.asin(asteroid.position[1]/distance);
			asteroid.acceleration[0] = -Math.cos(x_angle) * system.planet.gravity * time_slice;
			asteroid.acceleration[1] = -Math.sin(y_angle) * system.planet.gravity * time_slice;
		}
	}
	g_lastUpdate = (new Date()).getTime();
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
	canvas.fillStyle = g_astroidColor;
	canvas.beginPath();
	canvas.strokeStyle = "#000000";
	canvas.arc(asteroid.position[0]+(g_windowSize/2), asteroid.position[1]+(g_windowSize/2), asteroid.size, 0, g_circleRad);
	canvas.fill();
	canvas.beginPath();
	canvas.strokeStyle = "#FF0000";
	canvas.moveTo(asteroid.position[0]+g_windowSize/2, asteroid.position[1]+g_windowSize/2);
	canvas.lineTo(asteroid.position[0]+(g_windowSize/2)+asteroid.velocity[0]*5, asteroid.position[1]+(g_windowSize/2)+asteroid.velocity[1]*5);
	canvas.stroke();
	canvas.beginPath();
	canvas.strokeStyle = "#00FF00";
	canvas.moveTo(asteroid.position[0]+(g_windowSize/2), asteroid.position[1]+(g_windowSize/2));
	canvas.lineTo(asteroid.position[0]+(g_windowSize/2)+asteroid.acceleration[0]*5, asteroid.position[1]+(g_windowSize/2)+asteroid.acceleration[1]*5);
	canvas.stroke();
}

function DrawPlanet(canvas, planet)
{
	canvas.fillStyle = g_planetColor;
	canvas.beginPath();
	canvas.arc(g_windowSize/2, g_windowSize/2, planet.radius,0, g_circleRad);
	canvas.fill();
}
