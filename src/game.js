var g_windowSize = 512;
var g_gameWindowId = "gamewindow";

var g_planetRadius = 64;
var g_planetMass = 10;
var g_planetImageKey = "PLANET";
var g_gravity = 5;
var g_damping = 8;
var g_maxDamping = 10;
var g_stickyFactor = 5;

var g_numOrbits = 3;

var g_asteroidImageKey = "asteroid";

var g_maxAsteroidSize = 16;
var g_minAsteroidSize = 8;
var g_asteroidMass = 1;
var g_initialVelocity = 10;

var g_maxAsteroidCount = 100;
var g_minAsteroidCount = 30;

var g_maxStarSize = 5;
var g_minStarSize = 1;

var g_maxStarFlux = 2;
var g_minStarFlux = 0;

var g_minStarBrightness = 200;

var g_orbitalRange = (g_windowSize/2)-g_planetRadius;
var g_orbitWidth = g_orbitalRange/(g_numOrbits+1);

var g_timeScale = 1/10;
var g_maxTimestep = 10*g_timeScale; //ms
var g_gameTime = 0;

var g_astroidColor = "#666666";
var g_planetColor = "#000066";

var g_circleRad = 2*Math.PI;

var g_fps_target = 60;
var g_lastUpdate = (new Date()).getTime();
var g_vectorScale = 5;
var g_debugDrawPhysicsVectors = false;
var g_debugDrawDampingArcs = false;
var g_logEnabled = true;

var g_canvas = 0;
var g_game = 0;
var g_lastMouse = {x: 0, y: 0};

var g_missileKey = "missile";
var g_projectileSize = 16;

var g_playerKey = "player";
var g_weaponSpeed = 7;

var g_bulletKey = "bullet";

var g_sprites;
var g_assetList = [
	g_planetImageKey,
	g_asteroidImageKey,
	g_missileKey,
	g_playerKey,
	g_bulletKey
];
var g_keyManager = null;
var g_eventQueue = [];



$(document).ready(InitializeGame);

function InitializeGame()
{
	g_canvas = GetCanvas();
	g_canvas.drawRotated = DrawRotated.bind(g_canvas);
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
					position: {
						x: evt.clientX - rect.left,
						y: evt.clientY - rect.top
					}
				};
			})();		
		};
	canvas.onmousedown = function(evt) {
		var rect = canvas.getBoundingClientRect();
		g_eventQueue[g_eventQueue.length] = (function() {
			return {
				type: "click",
				position:
				{
					x: (evt.clientX - rect.left - g_windowSize/2),
					y: (evt.clientY - rect.top - g_windowSize/2)
				}
				};
			})();
		};
	g_keyManager = {
		_pressed: {},

		LEFT: 37,
		UP: 38,
		RIGHT: 39,
		DOWN: 40,
		W: 87,
		A: 65,
		S: 83,
		D: 68,
		SPACE: 32,
 
		isDown: function(keyCode) {
			return this._pressed[keyCode];
		},
		onKeydown: function(event) {
			this._pressed[event.keyCode] = true;
		},
		onKeyup: function(event) {
			delete this._pressed[event.keyCode];
		},
		upState: function() {
			return this._pressed[this.UP] || this._pressed[this.W];
		},
		downState: function() {
			return this._pressed[this.DOWN] || this._pressed[this.S];
		},
		leftState: function() {
			return this._pressed[this.LEFT] || this._pressed[this.A];
		},
		rightState: function() {
			return this._pressed[this.RIGHT] || this._pressed[this.D];
		},
		fireState: function() {
			return this._pressed[this.SPACE];
		}
	};
	window.addEventListener('keyup', function(event) { g_keyManager.onKeyup(event); event.preventDefault(); }, false);
	window.addEventListener('keydown', function(event) { g_keyManager.onKeydown(event); event.preventDefault(); }, false);

	return canvas.getContext("2d");
}

function GeneratePlayer()
{
	var player = {
		engine_power: 0.0005, //Forward thrust
		thruster_power: 0.0005, //Rotational thrust
		engine_damping: 0.01, //Slowly damp forward thrust
		thruster_damping: 0.008, //Rapidly damp rotation
		weapon_kick: 0.00001,
		position: {x: 0, y: 0, r: 0},
		velocity: {x: 0, y: 0, r: 0},
		acceleration: {x: 0, y: 0, r: 0},
		armor: 0,
		shield: 10,
		fuel: 10,
		image: GetSprite(g_playerKey),
		DrawHUD: function(canvas){
		},
		perform_damp: false,
		HandleInput: function(time_delta)
		{
			this.perform_damp = true;
			if(g_keyManager.rightState() || g_keyManager.leftState())
			{
				if(g_keyManager.rightState())
					this.acceleration.r = this.thruster_power*time_delta;
				else
					this.acceleration.r = -this.thruster_power*time_delta;
				this.perform_damp = false;
			}
			
			if(g_keyManager.downState())
			{

				Vec2Add(this.acceleration, Vec2XY(this.position.r+Math.PI, this.engine_power/2), time_delta);
				
				this.perform_damp = false;
			}
			if(g_keyManager.upState())
			{
				Vec2Add(this.acceleration, Vec2XY(this.position.r, this.engine_power), time_delta);
				this.perform_damp = false;
			}
			if(g_keyManager.fireState())
			{
				var pos = Vec3Copy(this.position);
				pos.r += (Math.PI/16)*(Math.random()-0.5);
				var event = 
				{
					type: "shot",
					position: pos,
					velocity: Vec2XY(pos.r, g_weaponSpeed),
					mass: 1
				}
				AddEvent(g_eventQueue, event);
				
				Vec2Add(this.acceleration, Vec2XY(this.position.r+Math.PI, this.weapon_kick), time_delta);
				
				//this.perform_damp = false;
			}
		},
		Update: function(time_delta) {
			this.HandleInput(time_delta);
			if(this.perform_damp)
			{
				//No keys, no accel
				this.acceleration = {x: 0, y: 0, r: 0};
				//Determine direction to apply damping
				var angle = Math.atan2(this.velocity.y, this.velocity.x);
				var damping = {x: 0, y: 0, r: 0};
				if(Math.sqrt(Math.pow(this.velocity.x,2) + Math.pow(this.velocity.y,2)) < this.engine_damping)
					damping = Vec3Copy(this.velocity);
				else
					damping = Vec2XY(angle+Math.PI, this.engine_damping * time_delta);
				if(Math.abs(this.velocity.r) >= this.thruster_damping * time_delta)
				{
					if(this.velocity.r < 0){
						damping.r = this.thruster_damping * time_delta;
					}else if(this.velocity.r > 0){
						damping.r = -this.thruster_damping * time_delta;
					}
				}else damping.r = -this.velocity.r;
				Vec3Add(this.velocity,damping); 
			}
			Vec3Add(this.position, this.velocity, time_delta);
			Vec3Add(this.velocity, this.acceleration, time_delta);
		},
		DrawPlayer: function(canvas)
		{
			if(this.image)
			{
				canvas.drawRotated(this.image, this.position.x, this.position.y, this.position.r+Math.PI/2);
			}else{
				canvas.fillStyle = "#FFFFFF";
				canvas.strokeStyle = "#000000";
				canvas.fillRect(this.position.x, this.position.y, this.position.x + 32, this.position.y+32);
			}
			if(g_debugDrawPhysicsVectors)
			{
				DrawPhysicsVectors(canvas, this);
			}
		}
	}
	return player;
	
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
	return Vec2XY(starting_angle, position); //{x: Math.cos(starting_angle)*position, y: Math.sin(starting_angle)*position};
}

function GenerateOrbitalVelocity(position, orbitIndex)
{
	//Consider 0 0 planet origin
	var distance = g_initialVelocity * Math.sqrt(Math.pow(position.x,2) + Math.pow(position.y,2));
	var critical_speed = Math.sqrt(g_gravity * g_planetMass / distance);
	var angle = Math.atan2(position.y, position.x);
	var critical_velocity = Vec2XY(angle + Math.PI/2, critical_speed);//{x: -Math.sin(angle) * (critical_speed), y: Math.cos(angle) *(critical_speed)};
	return critical_velocity;
	
}

function GenerateAsteroid()
{
	var asteroid =
	{
		size: (Math.random()*(g_maxAsteroidSize-g_minAsteroidSize))+g_minAsteroidSize,
		orbitIndex: Math.floor(Math.random()*g_numOrbits),
		acceleration: {x: 0, y: 0},
		velocity: {x: 0, y: 0},
		position: {x: 0,y: 0},
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
	position: {x: 0, y: 0},
	color: [255,255,255],
	flux: 0
	}
	star.position.x = Math.floor(Math.random()*g_windowSize);
	star.position.y = Math.floor(Math.random()*g_windowSize);
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
		//eventQueue: [],
		eventHandlers: null,
		planet: { 
					radius: g_planetRadius,
					mass: g_planetMass,
					image: GetSprite(g_planetImageKey)
				},
		player: {},
		stars: [],
		asteroids: [],
		ships: [],
		projectiles: [],
		finished_projectiles: [],
		explosions: [],
		LaunchProjectile : function(event)
		{
			Log("system", "generating projectile");
			if(typeof event.origin == 'undefined')
				event.origin = {x: 0, y: 0};
			var local_x = event.position.x - event.origin.x;
			var local_y = event.position.y - event.origin.y;
			var distance = Math.sqrt(Math.pow(local_x, 2) + Math.pow(local_y, 2));
			var angle = Math.atan2(local_y, local_x);
			var speed = 2;
			var projectile = {
				position : {x: event.origin.x, y: event.origin.y, r: angle},
				velocity : Vec2XY(angle, speed),
				acceleration : {x: 0, y: 0},
				mass: 10,
				target: {x: event.position.x, y: event.position.y},
				target_proximiny: 6,
				target_event: {type: "explosion", yield: 50},
				image: GetSprite(g_missileKey)
			};
			this.projectiles[this.projectiles.length] = projectile;
		},
		GenerateExplosion : function(event)
		{
			event.max_distance = event.yield;
			event.decay_rate = event.yield/20;
			event.Filter = function(target){return NearTarget(this.position, target.position, this.max_distance);};
			event.Apply = function(target){
				var local_x = this.position.x - target.position.x;
				var local_y = this.position.y - target.position.y;
				var angle = Math.atan2(local_y, local_x);
				var distance = 1 + Math.sqrt(Math.pow(local_x, 2) + Math.pow(local_y, 2));
				var magnitude = this.yield/(target.mass*Math.pow(distance, 2));
				Vec2Add(target.acceleration, Vec2XY(angle, magnitude));
			};
			this.explosions[this.explosions.length] = event;
			this.Broadcast(event);
		},
		SpawnBullets : function(event)
		{
			var bullet = {
				position: event.position,
				velocity: event.velocity,
				acceleration: {x: 0, y:0, r: 0},
				mass: event.mass,
				image: GetSprite(g_bulletKey)
			};
			this.projectiles[this.projectiles.length] = bullet;
		},
		Broadcast : function(event)
		{
			for(var index = 0; index < this.asteroids.length; ++index)
			{
				var asteroid = this.asteroids[index];
				if(event.Filter(asteroid))
				{
					event.Apply(asteroid);
				}
			}
			for(var index = 0; index < this.ships.length; ++index)
			{
				var ship = this.ships[index];
				if(event.Filter(ship))
				{
					event.Apply(ship);
				}
			}
			for(var index = 0; index < this.projectiles.length; ++index)
			{
				var projectile = this.projectiles[index];
				if(event.Filter(projectile))
				{
					event.Apply(projectile);
				}
			}
		}	
	}
	var desired_asteroid_count = Math.floor(Math.random()*(g_maxAsteroidCount-g_minAsteroidCount))+g_minAsteroidCount;
	var desired_star_count = Math.floor(Math.random()*100)+5;
	system.player = GeneratePlayer();
	system.eventHandlers = new Object;
	system.eventHandlers["click"] = system.LaunchProjectile.bind(system);
	system.eventHandlers["explosion"] = system.GenerateExplosion.bind(system); 
	system.eventHandlers["shot"] = system.SpawnBullets.bind(system);
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

function ApplyGravitation(system, time_delta, pva_object)
{
	var distance = Math.sqrt(Math.pow(pva_object.position.x, 2) + Math.pow(pva_object.position.y, 2));
	var gravity = ( g_gravity * system.planet.mass )/Math.pow(distance, 2);
	var angle = Math.atan2(pva_object.position.y, pva_object.position.x);
	Vec2Add(asteroid.velocity, asteroid.acceleration, time_delta);
	Vec2Set(asteroid.acceleration, Vec2XY(angle+Math.PI, gravity), time_delta);
}

function UpdateSystem(system)
{
	var time_delta = (((new Date()).getTime())-g_lastUpdate)*g_timeScale;
	while(g_eventQueue.length > 0)
	{
		var event = g_eventQueue.shift();
		if(system.eventHandlers[event.type])
		{
			(system.eventHandlers[event.type])(event);
		}
	}
	if (time_delta > g_maxTimestep)
	{
		time_delta = g_maxTimestep;
	}
		g_gameTime += time_delta;
		//Update player
		system.player.Update(time_delta);
		
		//Update asteroids
		for(var index = 0; index < system.asteroids.length; ++index)
		{
			var asteroid = system.asteroids[index];
		
			DampVelocityToOrbit(asteroid, time_delta);
			ApplyGravitation(system, time_delta, asteroid);
	
		}
		//Update projectiles
		for(var index = 0; index < system.finished_projectiles.length; ++ index)
		{
			system.projectiles.splice(system.finished_projectiles[index], 1);
		}
		system.finished_projectiles = [];
		for(var index = 0; index < system.projectiles.length; ++index)
		{
			var projectile = system.projectiles[index];
			if((Math.abs(projectile.position.x) > g_windowSize/2) || (Math.abs(projectile.position.y) > g_windowSize/2))
			{
				system.finished_projectiles[system.finished_projectiles.length] = index;
				continue;
			}
				
			Vec2Add(projectile.position, projectile.velocity, time_delta);
			ApplyGravitation(system, time_delta, projectile);
			
			if(typeof projectile.target != 'undefined')
			{
				if(NearTarget(projectile.position, projectile.target, projectile.target_proximiny))
				{
					Log("Projectile:", "Target Hit!");
					var event = projectile.target_event;
					
					event.position = projectile.position;
					
					AddEvent(g_eventQueue, event);
					system.finished_projectiles[system.finished_projectiles.length] = index;
				}
			}
		}
		var finished_explosions = [];
		for(var index = 0; index < system.explosions.length; ++index)
		{
			var explosion = system.explosions[index];
			explosion.yield = explosion.yield - explosion.decay_rate * time_delta;
			explosion.max_distance = explosion.max_distance - explosion.decay_rate * time_delta;
			if(explosion.max_distance < 1)
			{
				finished_explosions[finished_explosions.length] = index;
			}
		}
		for(var index = 0; index < finished_explosions.length; ++index)
		{
			system.explosions.splice(finished_explosions[index], 1);
		}
		
	
	g_lastUpdate = (new Date()).getTime();
}
function AddEvent(queue, event)
{
	queue[queue.length] = event;
}
function NearTarget(object, target, tolerance)
{
	var distance = Math.sqrt(Math.pow(target.x - object.x,2) + Math.pow(target.y - object.y,2));
	return distance < tolerance;
}

function DampVelocityToOrbit(asteroid, time_delta)
{
	//Calculate desired arc
	var distance = Math.sqrt(Math.pow(asteroid.position.x, 2) + Math.pow(asteroid.position.y, 2));
	
	var linear_x = asteroid.position.x + asteroid.velocity.x * time_delta;
	var linear_y = asteroid.position.y + asteroid.velocity.y * time_delta;
	
	var angle = Math.atan2(asteroid.position.y, asteroid.position.x);
	var velocity_arc_length = Math.sqrt(Math.pow(asteroid.velocity.x, 2) + Math.pow(asteroid.velocity.y,2))*time_delta;
	
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
	
	var linear_error = Math.sqrt(Math.pow(linear_x- arc_x, 2) + Math.pow(linear_y - arc_y, 2));
	
	if ( linear_error < (g_stickyFactor * g_timeScale))
	{
		var arc_damping = g_maxDamping - g_damping;
		asteroid.velocity.x = (arc_damping * velocity_arc_length * Math.cos(projected_angle+Math.PI/2) + g_damping * asteroid.velocity.x)/g_maxDamping;
		asteroid.velocity.y = (arc_damping * velocity_arc_length * Math.sin(projected_angle+Math.PI/2) + g_damping * asteroid.velocity.y)/g_maxDamping;
		asteroid.position.x = arc_x;
		asteroid.position.y = arc_y;
		
	}else{
		asteroid.position.x = linear_x;
		asteroid.position.y = linear_y;
	}
	
}

function Vec2Set(a, b, time)
{
	if(typeof time == 'undefined')
		time = 1;
	a.x = b.x * time;
	a.y = b.y * time;
}

function Vec2Add(a, b, time)
{
	if(typeof time == 'undefined')
		time = 1;
	a.x += (b.x * time);
	a.y += (b.y * time);
}

function Vec2XY(angle, magnitude)
{
	return {x: magnitude * Math.cos(angle), y: magnitude * Math.sin(angle)};
}

function Vec3Add(a, b, time)
{
	if(typeof time == 'undefined')
		time = 1;
	if(typeof b.r != 'undefined')
		a.r += b.r * time;
	a.x += (b.x * time);
	a.y += (b.y * time);
}

function Vec3Copy(b)
{
	a = {x: 0, y: 0, r: 0};
	if(typeof b.r != 'undefined')
		a.r = b.r;
	a.x = b.x;
	a.y = b.y;
	return a;
}

function DrawRotated(image, x, y, angle) { 
 
	this.save(); 
	this.translate(x+g_windowSize/2, y+g_windowSize/2);
	this.rotate(angle);
	this.drawImage(image, -(image.width/2), -(image.height/2));
	this.restore(); 
}

function ClearCanvas(canvas)
{
	canvas.fillStyle="#000000";
	canvas.fillRect(0,0,g_windowSize, g_windowSize);
}

function DrawPhysicsVectors(canvas, pva_object)
{
	canvas.beginPath();
	canvas.strokeStyle = "#FF0000";
	canvas.moveTo(pva_object.position.x+g_windowSize/2, pva_object.position.y+g_windowSize/2);
	canvas.lineTo(pva_object.position.x+(g_windowSize/2)+pva_object.velocity.x*(g_vectorScale/g_timeScale), pva_object.position.y+(g_windowSize/2)+pva_object.velocity.y*(g_vectorScale/g_timeScale));
	canvas.stroke();
	canvas.beginPath();
	canvas.strokeStyle = "#00FF00";
	canvas.moveTo(pva_object.position.x+(g_windowSize/2), pva_object.position.y+(g_windowSize/2));
	canvas.lineTo(pva_object.position.x+(g_windowSize/2)+pva_object.acceleration.x*(g_vectorScale/g_timeScale), pva_object.position.y+(g_windowSize/2)+pva_object.acceleration.y*(g_vectorScale/g_timeScale));
	canvas.stroke();
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
	for(var index = 0; index < system.explosions.length; ++index)
	{
		explosion = system.explosions[index];
		DrawExplosion(canvas, explosion);
	}		
	for(var index = 0; index < system.projectiles.length; ++index)
	{
		projectile = system.projectiles[index];
		DrawProjectile(canvas, projectile);
	}
	system.player.DrawPlayer(canvas);
	//DrawCursor(canvas, g_lastMouse.position);
}

function DrawStar(canvas, star)
{
	//No coordinate translation required
	canvas.fillStyle = "rgb(" + star.color[0] + "," + star.color[1] + "," + star.color[2] + ")";
	canvas.beginPath();
	canvas.arc(star.position.x, star.position.y, star.size, 0, g_circleRad);
	canvas.fill();
}

function DrawExplosion(canvas, explosion)
{
	canvas.beginPath();
	var blast = canvas.createRadialGradient(explosion.position.x+g_windowSize/2,explosion.position.y+g_windowSize/2,explosion.max_distance/2, explosion.position.x+g_windowSize/2, explosion.position.y+g_windowSize/2, explosion.max_distance);
	blast.addColorStop(0, "red");
	blast.addColorStop(1, "yellow");
	canvas.arc(explosion.position.x+g_windowSize/2, explosion.position.y+g_windowSize/2, explosion.max_distance, 0, g_circleRad);
	canvas.fillStyle = blast;
	canvas.fill();
}

function DrawAsteroid(canvas, asteroid)
{
	//Move asteroids into screenspace
	if(asteroid.image)
	{
		canvas.drawImage(asteroid.image, asteroid.position.x - asteroid.size/2 + g_windowSize/2, asteroid.position.y - asteroid.size/2 + g_windowSize/2, asteroid.size, asteroid.size);
	}else{
		canvas.fillStyle = g_astroidColor;
		canvas.beginPath();
		canvas.strokeStyle = "#000000";
		canvas.arc(asteroid.position.x+(g_windowSize/2), asteroid.position.y+(g_windowSize/2), asteroid.size, 0, g_circleRad);
		canvas.fill();
	}
	if(g_debugDrawPhysicsVectors)
	{
		DrawPhysicsVectors(canvas, asteroid);
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

function DrawProjectile(canvas, projectile)
{
	if(projectile.image)
	{
		canvas.drawRotated(projectile.image, projectile.position.x, projectile.position.y, projectile.position.r+Math.PI/2);
	}else{
		canvas.strokeStyle = "#FFFF00";
		canvas.beginPath();
		canvas.arc(projectile.position.x - g_windowSize/2, projectile.position.y - g_windowSize/2, 4, 0, g_circleRad);
		canvas.stroke();
	}
	if(typeof projectile.target != 'undefined')
	{
		canvas.strokeStyle = "#FFFF00";
		canvas.beginPath();
		canvas.arc(projectile.target.x+g_windowSize/2, projectile.target.y+g_windowSize/2, 5, 0, g_circleRad);
		canvas.stroke();
		canvas.beginPath();
		canvas.moveTo(projectile.target.x+g_windowSize/2, projectile.target.y+g_windowSize/2, g_windowSize/2);
		canvas.lineTo(projectile.target.x+5+g_windowSize/2, projectile.target.y+g_windowSize/2);
		canvas.lineTo(projectile.target.x-5+g_windowSize/2, projectile.target.y+g_windowSize/2);
		canvas.moveTo(projectile.target.x+g_windowSize/2, projectile.target.y+g_windowSize/2, g_windowSize/2);
		canvas.lineTo(projectile.target.x+g_windowSize/2, projectile.target.y+5+g_windowSize/2);
		canvas.lineTo(projectile.target.x+g_windowSize/2, projectile.target.y-5+g_windowSize/2);
		canvas.stroke();
	}
	
	if(g_debugDrawPhysicsVectors)
	{
		DrawPhysicsVectors(canvas, projectile);
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
	canvas.fillText(coordinates.x,coordinates.x,coordinates.y);
	canvas.fillText(coordinates.y,coordinates.x,coordinates.y+21);
}

function Log(component, message)
{
	if(g_logEnabled)
	{
		var time = new Date();
		var logwindow = document.getElementById("logwindow");
		var log_message = $("<div class='logmsg'>");
		$(log_message).append("time: " + component + "<br/><p>" + message +"</p>");  
		$(logwindow).append(log_message);
	}
}