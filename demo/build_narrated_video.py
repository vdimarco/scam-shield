#!/usr/bin/env python3
"""Add the recorded narration and restrained evidence highlights to the judge video."""

from pathlib import Path
from tempfile import TemporaryDirectory
import json
import subprocess

from build_judge_video import DEEP, GREEN, INK, MUTED, RED, WHITE, base, build_slides, font, lines


DEMO = Path(__file__).resolve().parent
OUT = DEMO / "scam-shield-narrated.mp4"
AUDIO = DEMO / "scam-shield-judge-voiceover-48k.m4a"
SUBTITLES = DEMO / "scam-shield-narrated.srt"
DURATIONS = [9, 11, 13, 13, 14, 11, 11, 9]
TRANSITION = 0.4
FPS = 24


def quota_slide():
    canvas, draw = base(
        5,
        "Requested second opinion · quota fallback",
        "Illustrative layout using current UI copy  •  recorded grounded request returned HTTP 429",
    )
    draw.text((75, 165), "A SECOND LOOK. A CLEAR LIMIT.", font=font(18, bold=True), fill=RED)
    lines(draw, "Web verification is\nunavailable right now.", 73, 216, 1090, 48, INK, bold=True, leading=1.2)
    draw.rounded_rectangle((76, 369, 1190, 587), radius=22, fill=WHITE, outline="#dacfc1", width=2)
    draw.rounded_rectangle((100, 395, 320, 440), radius=12, fill="#e9e1d3")
    draw.text((116, 407), "CLOUD FALLBACK", font=font(18, bold=True), fill=DEEP)
    draw.text((765, 409), "ILLUSTRATIVE COPY · NO SCREENSHOT", font=font(16, bold=True), fill=MUTED)
    lines(draw, "This explanation uses only the page shown.", 101, 461, 1020, 29, INK, bold=True)
    lines(draw, "Verify through the official app or a phone number you already trust.", 102, 524, 1020, 22, MUTED)
    return canvas


def highlights(index):
    # Highlights call out existing text, not simulated product interaction.
    if index == 1:
        return [
            (737, 357, 419, 39, RED, 2.0, 4.0),
            (737, 403, 419, 39, RED, 4.3, 6.4),
            (737, 449, 419, 39, RED, 6.7, 8.8),
        ]
    if index == 2:
        return [(65, 543, 451, 64, GREEN, 4.0, 9.5)]
    if index == 3:
        return [(894, 589, 291, 55, GREEN, 5.5, 10.0)]
    if index == 6:
        return [
            (650, 343, 545, 57, WHITE, 2.2, 4.2),
            (650, 423, 545, 57, WHITE, 4.3, 6.3),
            (650, 503, 545, 57, WHITE, 6.4, 8.4),
        ]
    return []


CAPTIONS = [
    (0.80, 3.35, "I built Scam Shield thinking about my grandmother."),
    (3.35, 7.20, "A rushed parcel notice could catch her off guard."),
    (8.80, 14.85, "This fictional page demands a tiny fee, card details,\nand a decision in thirty minutes."),
    (14.85, 17.92, "The pressure is the clue."),
    (19.50, 23.55, "In the live checker, Firebase AI Logic\nflagged that pressure."),
    (23.55, 27.90, "Chrome ran the check on this device;\nthe text stayed in the browser."),
    (32.00, 35.00, "The extension warns beside the page."),
    (35.00, 41.44, "On our test computer, the private model was unavailable,\nso this requested check used cloud fallback."),
    (44.40, 47.20, "She can ask for a second opinion."),
    (47.20, 53.60, "When web verification is unavailable, Scam Shield says\nthe explanation uses only this page"),
    (53.60, 57.76, "and points her to the official app or a saved number."),
    (58.00, 65.40, "In one small synthetic run, four of four suspicious pages\nwere flagged, and none of four ordinary pages falsely flagged."),
    (65.40, 69.20, "Real-world accuracy is untested."),
    (69.50, 71.50, "She stays in control."),
    (71.50, 74.00, "Close the page. Open the official delivery app."),
    (74.00, 77.66, "Or call a number she already trusts."),
    (79.40, 82.00, "Try the live checker and inspect the source."),
    (82.00, 86.36, "Give someone we love a calm moment\nbefore the next click."),
]


def timestamp(seconds):
    milliseconds = round(seconds * 1000)
    hours, milliseconds = divmod(milliseconds, 3_600_000)
    minutes, milliseconds = divmod(milliseconds, 60_000)
    whole, milliseconds = divmod(milliseconds, 1000)
    return f"{hours:02}:{minutes:02}:{whole:02},{milliseconds:03}"


def render():
    if not AUDIO.is_file():
        raise FileNotFoundError(AUDIO)
    slides = build_slides()
    slides[4] = quota_slide()
    SUBTITLES.write_text(
        "\n\n".join(
            f"{number}\n{timestamp(start)} --> {timestamp(end)}\n{caption}"
            for number, (start, end, caption) in enumerate(CAPTIONS, 1)
        ) + "\n",
        encoding="utf-8",
    )
    with TemporaryDirectory(prefix="scam-shield-narrated-") as temporary:
        command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y"]
        for index, (slide, duration) in enumerate(zip(slides, DURATIONS), 1):
            path = Path(temporary) / f"slide-{index:02}.png"
            slide.save(path)
            command += ["-framerate", str(FPS), "-loop", "1", "-t", str(duration), "-i", str(path)]
        command += ["-i", str(AUDIO)]
        filters = []
        for index in range(len(slides)):
            effect = f"[{index}:v]format=yuv420p"
            for x, y, width, height, color, start, end in highlights(index):
                effect += (
                    f",drawbox=x={x}:y={y}:w={width}:h={height}:color={color}@0.85:t=3:"
                    f"enable='between(t,{start},{end})'"
                )
            filters.append(f"{effect}[s{index}]")
        offset = DURATIONS[0] - TRANSITION
        previous = "s0"
        for index in range(1, len(slides)):
            name = f"v{index}"
            filters.append(
                f"[{previous}][s{index}]xfade=transition=fade:duration={TRANSITION}:offset={offset:.1f}[{name}]"
            )
            previous = name
            if index < len(slides) - 1:
                offset += DURATIONS[index] - TRANSITION
        command += [
            "-filter_complex", ";".join(filters), "-map", f"[{previous}]", "-map", "8:a:0",
            "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", str(OUT),
        ]
        subprocess.run(command, check=True)
    probe = json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type", "-of", "json", str(OUT)
    ]))
    seconds = float(probe["format"]["duration"])
    assert 87.9 < seconds < 88.5, f"Unexpected duration: {seconds}"
    assert {stream["codec_type"] for stream in probe["streams"]} == {"video", "audio"}
    assert len(CAPTIONS) == 18 and CAPTIONS[-1][1] < seconds
    print(f"{OUT} ({seconds:.2f} seconds, narration and video)")
    print(SUBTITLES)


if __name__ == "__main__":
    render()
