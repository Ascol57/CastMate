const path = require("node:path")

module.exports = {
	appId: "com.lordtocs.castmate",
	productName: "CastMate",
	asar: true,
	electronVersion: "34.2.0",
	directories: {
		output: "../../release",
	},
	files: [
		"dist/**/*",
		"!**/node_modules/*/{CHANGELOG.md,README.md,README,readme.md,readme}",
		"!**/node_modules/*/{test,__tests__,tests,powered-test,example,examples}",
		"!**/node_modules/*.d.ts",
		"!**/node_modules/.bin",
		"!**/*.{iml,o,hprof,orig,pyc,pyo,rbc,swp,csproj,sln,xproj}",
		"!.editorconfig",
		"!**/._*",
		"!**/{.DS_Store,.git,.hg,.svn,CVS,RCS,SCCS,.gitignore,.gitattributes}",
		"!**/{__pycache__,thumbs.db,.flowconfig,.idea,.vs,.nyc_output}",
		"!**/{appveyor.yml,.travis.yml,circle.yml}",
		"!**/{npm-debug.log,yarn.lock,.yarn-integrity,.yarn-metadata.json}",
	],
	mac: {
		artifactName: "${productName}_${version}.${ext}",
		target: ["dmg"],
	},
	npmRebuild: true,
	nodeGypRebuild: false,
	nativeRebuilder: "sequential",
	win: {
		target: [
			{
				target: "nsis",
				arch: ["x64"],
			},
			{
				target: "portable",
				arch: ["x64"],
			},
		],
		artifactName: "${productName}_${version}.${ext}",
		extraResources: [
			{
				from: "../../node_modules/@ffmpeg-installer/win32-x64",
				to: "ffmpeg/bin",
				filter: ["**/*.exe"],
			},
			{
				from: "../../node_modules/@ffprobe-installer/win32-x64",
				to: "ffmpeg/bin",
				filter: ["**/*.exe"],
			},
			{
				from: "../../node_modules/regedit/vbs",
				to: "regedit/vbs",
				filter: ["**/*"],
			},
		],
	},
	linux: {
		target: ["AppImage", "deb"],
		category: "AudioVideo",
		artifactName: "${productName}_${version}_${arch}.${ext}",
		maintainer: "Scott Resnick <lordtocs@gmail.com>",
		synopsis: "Streamer automation: Twitch, OBS, lights, sounds, TTS",
		description:
			"CastMate is an open-source automation app for live streamers. " +
			"It links services and devices — Twitch chat and channel-points, " +
			"OBS Studio, Philips Hue / LIFX / Govee / Twinkly lights, Discord, " +
			"Minecraft, sounds, text-to-speech, overlays and more — into a " +
			"single point-and-click editor. Build profiles that react to " +
			"viewer rewards, raids, subs, follows, chat commands, timers, or " +
			"external HTTP triggers; switch OBS scenes, play sound effects, " +
			"change lights, post to Discord, drive a Minecraft server, or " +
			"anything else you can wire up.",
		extraResources: [
			{
				from: "../../node_modules/@ffmpeg-installer/linux-x64",
				to: "ffmpeg/bin",
				filter: ["ffmpeg"],
			},
			{
				from: "../../node_modules/@ffprobe-installer/linux-x64",
				to: "ffmpeg/bin",
				filter: ["ffprobe"],
			},
			{
				// Shipped inside the .deb so the afterInstall script (run as root by dpkg)
				from: "build/linux/99-castmate-uinput.rules",
				to: "linux/99-castmate-uinput.rules",
			},
			{
				// AppStream metainfo
				from: "build/linux/com.lordtocs.castmate.metainfo.xml",
				to: "linux/com.lordtocs.castmate.metainfo.xml",
			},
		],
	},
	deb: {
		depends: [
			"libx11-6",
			"libxtst6",
			"pulseaudio-utils | pipewire-pulse",
		],
		recommends: ["espeak-ng"],
		// Scripts dpkg runs as root after install / before remove.
		afterInstall: "build/linux/after-install.sh",
		afterRemove: "build/linux/after-remove.sh",
		// Install the udev rules and AppStream metainfo with the .deb.
		fpm: [
			`${path.join(__dirname, "build/linux/99-castmate-uinput.rules")}=/etc/udev/rules.d/99-castmate-uinput.rules`,
			`${path.join(__dirname, "build/linux/com.lordtocs.castmate.metainfo.xml")}=/usr/share/metainfo/com.lordtocs.castmate.metainfo.xml`,
		],
	},
	nsis: {
		oneClick: false,
		perMachine: false,
		allowToChangeInstallationDirectory: true,
		deleteAppDataOnUninstall: true,
	},
	portable: {
		artifactName: "${productName}_${version}-portable.${ext}",
	},
	extraFiles: [
		{
			from: "../castmate-obs-overlay/dist/obs-overlay",
			to: "obs-overlay",
		},
		// {
		// 	from: "starter_media",
		// 	to: "starter_media"
		// }
	],
	publish: [
		{
			provider: "github",
			owner: "LordTocs",
			repo: "CastMate",
		},
	],
}
