import childProcess from "node:child_process"
import { createRequire } from "node:module"
import path from "path"
import { shell, app } from "electron"
import { usePluginLogger } from "../logging/logging"

// CJS-only installers loaded via createRequire to avoid Electron's ESM→CJS interop
// crash (TypeError on cjsPreparseModuleExports in Node 20.18 embedded in Electron 34).
const cjsRequire = createRequire(import.meta.url)
const ffmpegInstaller = cjsRequire("@ffmpeg-installer/ffmpeg") as { path: string }
const ffprobeInstaller = cjsRequire("@ffprobe-installer/ffprobe") as { path: string }

const logger = usePluginLogger("ffmpeg")

interface FFProbeStreamBase {
	index: number
	codec_name: string
	codec_tag_string: string
	codec_tag: string
	r_frame_rate: string
	avg_frame_rate: string
	time_base: string
	start_pts: number
	start_time: string
	duration_ts: number
	duration: string
}

interface FFProbeStreamAudio extends FFProbeStreamBase {
	codec_type: "audio"
	sample_fmt: string
	sample_rate: string
	channels: number
	channel_layout: string
	bits_per_sample: number
	initial_padding: number
	bit_rate: string
}

interface FFProbeStreamVideo extends FFProbeStreamBase {
	codec_type: "video"
	width: number
	height: number
	coded_width: number
	coded_height: number
	has_b_frames: number
	sample_aspect_ratio: string
	display_aspect_ratio: string
	pix_fmt: string
	level: number
	refs: number
	nb_frames: string
}

type FFProbeStream = FFProbeStreamVideo | FFProbeStreamAudio

interface FFProbeFormat {
	filename: string
	nb_streams: number
	nb_programs: number
	nb_stream_groups: 0
	format_name: string
	format_long_name: string
	start_time: string
	duration: string
	size: string
	bit_rate: string
	probe_score: number
}

interface FFProbeOutput {
	streams: FFProbeStream[]
	format: FFProbeFormat
}

let ffprobePath: string = ""
let ffmpegPath: string = ""

export async function ffprobe(file: string): Promise<FFProbeOutput> {
	const resolvedFile = path.resolve(file)
	const execPromise = new Promise<string>((resolve, reject) => {
		childProcess.exec(
			`"${ffprobePath}" -i "${resolvedFile}" -v quiet -print_format json -show_format -show_streams`,
			{},
			(err, stdout, stderr) => {
				if (err) return reject(err)
				resolve(stdout)
			}
		)
	})

	const result = await execPromise

	const json = JSON.parse(result)

	return json as FFProbeOutput
}

export function setupFFMpegPaths() {
	if (app.isPackaged) {
		const binPath = path.join(import.meta.dirname, "../../../", "ffmpeg/bin")
		const exeSuffix = process.platform === "win32" ? ".exe" : ""

		ffprobePath = path.resolve(binPath, `ffprobe${exeSuffix}`)
		ffmpegPath = path.resolve(binPath, `ffmpeg${exeSuffix}`)
	} else {
		ffprobePath = ffprobeInstaller.path
		ffmpegPath = ffmpegInstaller.path
	}

	logger.log("ffmpeg path", ffmpegPath)
	logger.log("ffprobe path", ffprobePath)
}
