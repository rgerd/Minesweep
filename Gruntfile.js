module.exports = function(grunt) {
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),

		uglify: {
			options: {
				mangle: true,
				beautify: false,
				compress: true
			},
			dist: {
				files: {
					"public/javascripts/game.min.js" : 'public/javascripts/game.js',
					"public/javascripts/sweep.min.js" : 'public/javascripts/minesweeper.js'
				}
			}
		},

		cssmin: {
			target: {
				files: {
					'public/stylesheets/sweep.min.css' : 'public/stylesheets/minesweeper.css'
				}
			}
		}
	});


	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-cssmin');

	grunt.registerTask('default', ['uglify', 'cssmin']);
};
