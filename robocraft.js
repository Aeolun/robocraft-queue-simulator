var phonecatApp = angular.module('roboApp', []);

var params = {
	avg_duration: 180,
	return_chance: 0.45,
	leave_chance: 0.05,
	new_chance: 0.7
};
var players = [];
var games = [];

function generatePlayer() {
	var newlvl = chance.integer({min:1, max:100});
	var baserr = Math.min(292000 / 75 * newlvl, 292000*0.85);
	var rr = Math.round(Math.max(Math.min(chance.normal({mean: baserr, dev: baserr*0.5}), 292000), 200));
	var type = null;
	if (rr < 5000) {
		type = chance.weighted(['smg', 'plasma'], [60, 40]);
	} else if (rr < 30000) {
		type = chance.weighted(['smg', 'plasma', 'rail'], [40, 20, 20]);
	} else {
		type = chance.weighted(['smg', 'plasma', 'rail', 'medic'], [40, 20, 20, 20]);
	}
	flyer = false;
	if (rr > 4000) {
		flyer = chance.weighted([true, false], [40, 60]);
	}

	players.push({
		name: chance.email(),
		rr: rr,
		type: type,
		flyer: flyer,
		level: newlvl,
		wait: 0
	})
}

for(var i = 0; i < 2000; i++) {
	generatePlayer();
}

players.sort(function(a, b) {
	if (a.rr > b.rr) return -1;
	if (a.rr == b.rr) return 0;
	return 1;
})

phonecatApp.controller('queueCtrl', function ($scope) {
	$scope.games = games;
	$scope.players = players;
	$scope.params = params;
	$scope.waitingList = [];
	$scope.avgWait = 0;
	$scope.playersInGame = 0;
	$scope.stepInterval = null;
	$scope.activeGame = null;
	$scope.queueFunction = "var startAt = 0;\n\
var playersInGame = 16;\n\
var canDo = true;\n\
var times = 0;\n\
while(canDo) {\n\
	canDo = false;\n\
	playersInGame = 16;\n\
	while (canDo == false) {\n\
		startAt = 0;\n\
		while (canDo == false) {\n\
			if (queue.length > startAt + playersInGame - 1 && queue[startAt + playersInGame - 1].rr > queue[startAt].rr / (2+queue[startAt].wait/60)) {\n\
				canDo = true;\n\
				break;\n\
			} else {\n\
				startAt++;\n\
				if (startAt + playersInGame - 1 >= queue.length) break;\n\
			}\n\
		}\n\
		if (canDo == false) playersInGame -= 2;\n\
		if (playersInGame <= 6) break;\n\
		if (times > 1000) break;\n\
	}\n\
\n\
	if (canDo == true) {\n\
		console.log('initializing game starting at '+startAt+' with '+playersInGame+' players');\n\
		var newplayers = queue.slice(startAt, startAt+playersInGame);\n\
		console.log(newplayers);\n\
		newplayers.sort(function(a, b) {\n\
			if (a.rr > b.rr) return -1;\n\
			if (a.rr < b.rr) return -1;\n\
			return 0;\n\
		});\n\
		var teams = {\n\
			a: [],\n\
			b: []\n\
		}\n\
		for(var i = 0; i < newplayers.length; i++) {\n\
			if (i % 2 == 0) {\n\
				teams.a.push(newplayers[i]);\n\
			} else {\n\
				teams.b.push(newplayers[i]);\n\
			}\n\
		}\n\
		startGame(teams.a, teams.b);\n\
	} else {\n\
		console.log('not enough players in queue')\n\
	}\n\
}";

	function advanceGames() {
		var deletable = [];
		for(var i = 0; i < $scope.players.length; i++) {
			$scope.players[i].wait++;
		}
		for(var i = 0; i < $scope.games.length; i++) {
			$scope.games[i].duration++;
			if ($scope.games[i].duration >= $scope.games[i].max_duration) {
				deletable.push($scope.games[i]);
			}
		}
		for(var i = 0; i < deletable.length; i++) {
			for(var j = 0; j < deletable[i].teamA.length; j++) {
				$scope.waitingList.push(deletable[i].teamA[j]);
			}
			for(var j = 0; j < deletable[i].teamB.length; j++) {
				$scope.waitingList.push(deletable[i].teamB[j]);
			}
			var index = $scope.games.indexOf(deletable[i]);
			$scope.games.splice(index, 1);
		}
	};

	function startGame(teamA, teamB) {
		var newgame = {
			id: chance.guid(),
			teamA: [],
			teamB: []
		};
		var stats = {
			max:0,
			min:292000
		};
		var totalrr = {
			all: 0,
			a: 0,
			b: 0
		};
		console.log("Queue size before game start: " + $scope.players.length);
		for(var i = 0; i < teamA.length; i++) {
			if (teamA[i].rr > stats.max) stats.max = teamA[i].rr;
			if (teamA[i].rr < stats.min) stats.min = teamA[i].rr;
			totalrr.all += teamA[i].rr;

			totalrr.a += teamA[i].rr;
			newgame.teamA.push(teamA[i]);

			var index = $scope.players.indexOf(teamA[i]);
			console.log("Removing player "+index);
			$scope.players.splice(index, 1);
		}
		for(var i = 0; i < teamB.length; i++) {
			if (teamB[i].rr > stats.max) stats.max = teamB[i].rr;
			if (teamB[i].rr < stats.min) stats.min = teamB[i].rr;
			totalrr.all += teamB[i].rr;

			totalrr.a += teamB[i].rr;
			newgame.teamB.push(teamB[i]);

			var index = $scope.players.indexOf(teamB[i]);
			console.log("Removing player "+index);
			$scope.players.splice(index, 1);
		}
		console.log("Queue size remaining: " + $scope.players.length);
		newgame.average_rr = Math.round(totalrr.all / (teamA.length+teamB.length));
		newgame.min_rr = stats.min;
		newgame.max_rr = stats.max;
		newgame.a_total = totalrr.a;
		newgame.b_total = totalrr.b;
		newgame.players = teamA.length+teamB.length;
		newgame.duration = 0;
		newgame.max_duration = Math.round(chance.normal({mean: params.avg_duration, dev: params.avg_duration*0.1}));
		$scope.games.push(newgame);
	}

	function modified(queue) {
		try {
			eval($scope.queueFunction)
		} catch(e) {
			console.error(e);
		}
	}

	function step() {
		console.log('round');


		/*
		 QUEUE LOGIC
		 */
		modified($scope.players);

		/*
		 WAITING LIST RETURN
		 */
		var returners = [];
		var leavers = [];
		for(var i = 0; i < $scope.waitingList.length; i++) {
			if (Math.random() < $scope.params.return_chance) {
				returners.push($scope.waitingList[i]);
			} else if (Math.random() < $scope.params.leave_chance) {
				leavers.push($scope.waitingList[i]);
			}
		}
		if (Math.random() < $scope.params.new_chance) {
			generatePlayer();
		}
		for(var i = 0; i < returners.length; i++) {
			returners[i].wait = 0;
			$scope.players.push(returners[i]);
			var index = $scope.waitingList.indexOf(returners[i]);
			$scope.waitingList.splice(index, 1);
		}
		for(var i = 0; i < leavers.length; i++) {
			var index = $scope.waitingList.indexOf(leavers[i]);
			$scope.waitingList.splice(index, 1);
		}
		/*
		 AVERAGE TIME
		 */
		var totalWait = 0;
		for(var i = 0; i < $scope.players.length; i++) {
			if ($scope.players[i].wait > totalWait) totalWait = $scope.players[i].wait;
		}
		$scope.avgWait = totalWait;
		$scope.playersInGame = 0;
		for(var i = 0; i < $scope.games.length; i++) {
			$scope.playersInGame += $scope.games[i].players;
		}
		if ($scope.players.length < 500) {
			$scope.players.sort(function(a, b) {
				if (a.rr > b.rr*1.1) return -1;
				if (a.rr*1.1 < b.rr) return 1;
				if (a.wait > b.wait) return -1;
				if (a.wait < b.wait) return 1;
				return 0;
			})
		}
		advanceGames();
	}

	$scope.setActiveGame = function(game) {
		console.log('set active game', game);
		$scope.activeGame = game;
	}

	$scope.start = function() {
		if ($scope.stepInterval == null) {
			var lock = false;
			var rounds = 0;
			$scope.stepInterval = setInterval(function () {
				if (lock == false) {
					lock = true;
					step();
					if (rounds % 5 == 0 || $scope.players.length < 500) $scope.$apply();
					rounds++;
					lock = false;
				}
			}, 100);
		}
	}

	$scope.stop = function() {
		clearInterval($scope.stepInterval);
		$scope.stepInterval = null;
	}

	$scope.step = function() {
		step();
	}

	var editor = ace.edit("editor");
	editor.getSession().setMode("ace/mode/javascript");
	editor.setValue($scope.queueFunction);

	editor.getSession().on('change', function(e) {
		$scope.queueFunction = editor.getValue();
	});
});
