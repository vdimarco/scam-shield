#!/usr/bin/env python3
"""Render the judge cut from source-verified on-device extension footage."""

from pathlib import Path
from tempfile import TemporaryDirectory
import json
import subprocess

from PIL import ImageDraw

from build_judge_video import BG, GREEN, INK, MUTED, RED, WHITE, build_slides, font


DEMO = Path(__file__).resolve().parent
OUT = DEMO / "scam-shield-judge-final.mp4"
AUDIO = DEMO / "scam-shield-judge-voiceover-48k.m4a"
LIVE = DEMO / "automatic-warning-and-panel-on-device.webm"
OBSERVATION = DEMO / "automatic-warning-and-panel-on-device.json"
SUBTITLES = DEMO / "scam-shield-judge-final.srt"
DURATIONS = [9, 11, 10, 9, 23, 11, 9]
ORIGINAL_SLIDES = [0, 1, 2, 3, 5, 6, 7]
TRANSITION = 0.4
FPS = 24
TOTAL_SECONDS = sum(DURATIONS) - TRANSITION * (len(DURATIONS) - 1)


CAPTIONS = [
    (0.80, 3.35, "I built Scam Shield thinking about my grandmother."),
    (3.35, 7.20, "A rushed parcel notice could catch her off guard."),
    (8.80, 14.85, "This fictional page demands a tiny fee, card details,\nand a decision in thirty minutes."),
    (14.85, 17.92, "The pressure is the clue."),
    (19.50, 23.55, "In the live checker, Firebase AI Logic\nflagged that pressure."),
    (23.55, 27.90, "Chrome ran the check on this device;\nthe text stayed in the browser."),
    (32.10, 34.15, "The extension warns beside the page."),
    (34.80, 36.38, "She stays in control."),
    (37.80, 44.50, "On eighty fresh archived pages, Scam Shield warned\non thirty of forty scams."),
    (44.50, 50.00, "Nine were unsure, one timed out,\nand none were called safe."),
    (50.80, 54.70, "Of forty legitimate pages, one was falsely flagged."),
    (55.40, 58.20, "These results do not measure live browsing."),
    (60.30, 62.95, "Close the page. Open the official delivery app."),
    (62.95, 66.61, "Or call a number she already trusts."),
    (71.00, 73.60, "Try the live checker and inspect the source."),
    (73.60, 77.96, "Give someone we love a calm moment\nbefore the next click."),
]


def probe(path):
    return json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type",
        "-of", "json", str(path),
    ]))


def timestamp(seconds):
    milliseconds = round(seconds * 1000)
    hours, milliseconds = divmod(milliseconds, 3_600_000)
    minutes, milliseconds = divmod(milliseconds, 60_000)
    whole, milliseconds = divmod(milliseconds, 1000)
    return f"{hours:02}:{minutes:02}:{whole:02},{milliseconds:03}"


def build_audio():
    # Keep the original Faye performance outside the updated evidence scene.
    pieces = [
        ("voiceover-01.mp3", 0, 6.40, 0.80),
        ("voiceover-02.mp3", 0, 9.12, 8.80),
        ("voiceover-03.mp3", 0, 8.40, 19.50),
        ("voiceover-04.mp3", 0, 2.20, 32.10),
        ("voiceover-07.mp3", 0, 1.75, 34.80),
        ("voiceover-80-archived.mp3", 0, 20.32, 37.80),
        ("voiceover-07.mp3", 1.85, 8.16, 60.30),
        ("voiceover-08.mp3", 0, 6.96, 71.00),
    ]
    command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y"]
    for name, *_ in pieces:
        command += ["-i", str(DEMO / name)]
    filters = [f"anullsrc=r=48000:cl=stereo,atrim=duration={TOTAL_SECONDS:.2f}[bed]"]
    for index, (_, start, end, position) in enumerate(pieces):
        filters.append(
            f"[{index}:a]atrim=start={start}:end={end},asetpts=PTS-STARTPTS,"
            f"aresample=48000,aformat=channel_layouts=stereo,volume=0.66,"
            f"adelay=delays={round(position * 1000)}:all=1[a{index}]"
        )
    inputs = "[bed]" + "".join(f"[a{index}]" for index in range(len(pieces)))
    filters.append(
        f"{inputs}amix=inputs={len(pieces) + 1}:duration=longest:normalize=0,"
        f"atrim=duration={TOTAL_SECONDS:.2f},asetpts=PTS-STARTPTS[out]"
    )
    command += ["-filter_complex", ";".join(filters), "-map", "[out]",
                "-c:a", "aac", "-b:a", "192k", str(AUDIO)]
    subprocess.run(command, check=True)


def highlights(original_index):
    # These outlines point at observed text; they do not simulate product UI.
    if original_index == 1:
        return [
            (737, 357, 419, 39, RED, 2.0, 4.0),
            (737, 403, 419, 39, RED, 4.3, 6.4),
            (737, 449, 419, 39, RED, 6.7, 8.8),
        ]
    if original_index == 2:
        return [(65, 543, 451, 64, GREEN, 4.0, 9.5)]
    if original_index == 6:
        return [
            (650, 343, 545, 57, WHITE, 2.2, 4.2),
            (650, 423, 545, 57, WHITE, 4.3, 6.3),
            (650, 503, 545, 57, WHITE, 6.4, 8.4),
        ]
    return []


def render():
    summary = json.loads((DEMO.parent / "evaluation/real-world/results-fresh-80-final.json").read_text())["summary"]
    if summary["byLabel"]["scam"] != {"suspicious": 30, "unsure": 9, "safe": 0, "error": 1} or \
            summary["byLabel"]["benign"] != {"suspicious": 1, "unsure": 21, "safe": 18, "error": 0} or \
            summary["sources"]["on-device"] != 79:
        raise ValueError("Video scorecard differs from the recorded fresh 80-page run")
    for path in (LIVE, OBSERVATION):
        if not path.is_file():
            raise FileNotFoundError(path)
    observation = json.loads(OBSERVATION.read_text(encoding="utf-8"))
    if observation["risk"] != "suspicious" or not observation["warningVisible"] or \
            observation["source"] != "This page's content was checked on this computer." or \
            observation["nativePanelWidth"] != 360 or \
            "Synthetic inert local" not in observation["fixture"] or \
            "Two synchronized genuine Chrome targets" not in observation["composition"]:
        raise ValueError(f"Cannot claim a genuine automatic on-device warning: {observation}")
    live_seconds = float(probe(LIVE)["format"]["duration"])
    if not 8.4 <= live_seconds <= DURATIONS[3]:
        raise ValueError(f"Unexpected automatic warning capture duration: {live_seconds}")

    build_audio()
    SUBTITLES.write_text(
        "\n\n".join(
            f"{number}\n{timestamp(start)} --> {timestamp(end)}\n{caption}"
            for number, (start, end, caption) in enumerate(CAPTIONS, 1)
        ) + "\n", encoding="utf-8",
    )

    original = build_slides()
    slides = [original[index] for index in ORIGINAL_SLIDES]
    for index in (1, 2, 3, 4):
        draw = ImageDraw.Draw(slides[index])
        draw.rectangle((1110, 31, 1212, 70), fill=BG)
        draw.text((1120, 40), f"{index + 1:02d} / 07", font=font(17, bold=True), fill=MUTED)
    with TemporaryDirectory(prefix="scam-shield-narrated-") as temporary:
        command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y"]
        for index, (slide, duration) in enumerate(zip(slides, DURATIONS), 1):
            path = Path(temporary) / f"slide-{index:02}.png"
            slide.save(path)
            command += ["-framerate", str(FPS), "-loop", "1", "-t", str(duration), "-i", str(path)]
        command += ["-i", str(AUDIO), "-i", str(LIVE)]
        filters = []
        for index, original_index in enumerate(ORIGINAL_SLIDES):
            if index == 3:
                continue
            effect = f"[{index}:v]format=yuv420p"
            for x, y, width, height, color, start, end in highlights(original_index):
                effect += (
                    f",drawbox=x={x}:y={y}:w={width}:h={height}:color={color}@0.85:t=3:"
                    f"enable='between(t,{start},{end})'"
                )
            filters.append(f"{effect}[s{index}]")
        filters += [
            f"[8:v]trim=duration={live_seconds:.3f},setpts=PTS-STARTPTS,scale=1280:720,"
            f"fps={FPS},tpad=stop_mode=clone:stop_duration={DURATIONS[3] - live_seconds:.3f},"
            "drawbox=x=0:y=0:w=240:h=36:color=0x19483a@0.94:t=fill,"
            "drawtext=fontfile=/usr/share/fonts/TTF/DejaVuSans-Bold.ttf:"
            "text=SYNTHETIC LOCAL TEST:fontcolor=white:fontsize=15:x=10:y=8,"
            "format=yuv420p[scene3]",
        ]
        scenes = [f"s{index}" for index in range(len(slides))]
        scenes[3] = "scene3"
        offset = DURATIONS[0] - TRANSITION
        previous = scenes[0]
        for index in range(1, len(slides)):
            name = f"v{index}"
            filters.append(
                f"[{previous}][{scenes[index]}]xfade=transition=fade:duration={TRANSITION}:offset={offset:.1f}[{name}]"
            )
            previous = name
            if index < len(slides) - 1:
                offset += DURATIONS[index] - TRANSITION
        command += [
            "-filter_complex", ";".join(filters), "-map", f"[{previous}]", "-map", "7:a:0",
            "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", str(OUT),
        ]
        subprocess.run(command, check=True)
    final = probe(OUT)
    seconds = float(final["format"]["duration"])
    assert abs(seconds - TOTAL_SECONDS) < 0.15, f"Unexpected duration: {seconds}"
    assert {stream["codec_type"] for stream in final["streams"]} == {"video", "audio"}
    assert CAPTIONS[-1][1] < seconds
    print(f"{OUT} ({seconds:.2f} seconds, narration and native on-device footage)")
    print(SUBTITLES)


if __name__ == "__main__":
    render()
