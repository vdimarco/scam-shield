#!/usr/bin/env python3
"""Build a captioned judge-video candidate from labelled, observed assets."""

from pathlib import Path
from tempfile import TemporaryDirectory
import json
import subprocess

from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parent.parent
DEMO = ROOT / "demo"
OUT = DEMO / "scam-shield-judge-candidate.mp4"
W, H = 1280, 720
FPS = 24
BG = "#f5f0e8"
INK = "#1b3431"
DEEP = "#19483a"
RED = "#ad352b"
GREEN = "#27714f"
MUTED = "#596b66"
WHITE = "#fffcf6"
SERIF = "/usr/share/fonts/TTF/DejaVuSerif-Bold.ttf"
SANS = "/usr/share/fonts/TTF/DejaVuSans.ttf"
BOLD = "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf"


def font(size, bold=False, serif=False):
    return ImageFont.truetype(SERIF if serif else BOLD if bold else SANS, size)


def lines(draw, message, x, y, width, size, color=INK, bold=False, leading=1.35):
    face = font(size, bold=bold)
    step = round(size * leading)
    for paragraph in message.split("\n"):
        words = paragraph.split()
        current = ""
        for word in words:
            attempt = f"{current} {word}".strip()
            if current and draw.textlength(attempt, font=face) > width:
                draw.text((x, y), current, font=face, fill=color)
                y += step
                current = word
            else:
                current = attempt
        if current:
            draw.text((x, y), current, font=face, fill=color)
            y += step
        elif not words:
            y += step
    return y


def image_card(canvas, source, box, crop=None, cover=False, radius=18):
    source = Image.open(source).convert("RGB")
    if crop:
        source = source.crop(crop)
    x, y, w, h = box
    fitted = ImageOps.fit(source, (w, h), method=Image.Resampling.LANCZOS) if cover else ImageOps.contain(source, (w, h), method=Image.Resampling.LANCZOS)
    tile = Image.new("RGB", (w, h), WHITE)
    tile.paste(fitted, ((w - fitted.width) // 2, (h - fitted.height) // 2))
    mask = Image.new("L", (w, h))
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, w - 1, h - 1), radius=radius, fill=255)
    canvas.paste(tile, (x, y), mask)
    ImageDraw.Draw(canvas).rounded_rectangle((x, y, x + w - 1, y + h - 1), radius=radius, outline="#dacfc1", width=2)


def base(number, label, footer):
    canvas = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(canvas)
    draw.text((68, 39), "SCAM SHIELD  /  JUDGE DEMO", font=font(18, bold=True), fill=DEEP)
    draw.text((1120, 40), f"{number:02d} / 08", font=font(17, bold=True), fill=MUTED)
    draw.line((68, 78, 1212, 78), fill="#d7cfc2", width=2)
    draw.text((68, 104), label.upper(), font=font(16, bold=True), fill=RED)
    draw.line((68, 659, 1212, 659), fill="#d7cfc2", width=2)
    draw.text((68, 672), footer, font=font(14), fill=MUTED)
    return canvas, draw


def build_slides():
    hero = ROOT / "web-demo/public/assets/grandmother-laptop.webp"
    parcel = DEMO / "frames/02-parcel-page.png"
    parcel_result = DEMO / "frames/02-parcel-result.png"
    hosted = DEMO / "hosted-on-device-proof.png"
    fallback = DEMO / "frames/04-second-opinion-fallback.png"
    for path in (hero, parcel, parcel_result, hosted, fallback):
        if not path.is_file():
            raise FileNotFoundError(path)

    slides = []

    # 1: the human reason for the project.
    canvas = Image.new("RGB", (W, H), DEEP)
    image_card(canvas, hero, (0, 0, 690, 720), cover=True, radius=0)
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((690, 0, W, H), fill=DEEP)
    draw.text((755, 100), "SCAM SHIELD", font=font(20, bold=True), fill="#bed9ca")
    lines(draw, "What if Grandma\nclicked first?", 750, 168, 465, 53, WHITE, bold=True, leading=1.2)
    lines(draw, "A parcel notice. A tiny fee.\nA card number requested before\nshe has time to think.", 755, 357, 450, 27, "#e6eee7", leading=1.45)
    draw.rounded_rectangle((52, 660, 235, 697), radius=12, fill="#17372f")
    draw.text((68, 668), "Illustrative portrait", font=font(16, bold=True), fill=WHITE)
    draw.text((755, 623), "Fictional scenario  •  no real payment page", font=font(17), fill="#bed9ca")
    slides.append(canvas)

    # 2: the exact synthetic page used for the observed checks.
    canvas, draw = base(2, "The suspicious moment", "Synthetic local fixture  •  inactive controls  •  fictional .invalid address")
    image_card(canvas, parcel, (67, 166, 635, 472))
    lines(draw, "A small fee.\nA big rush.", 748, 188, 450, 48, INK, bold=True, leading=1.22)
    draw.text((750, 367), "30-MINUTE DEADLINE", font=font(21, bold=True), fill=RED)
    draw.text((750, 413), "$1.95 REDELIVERY FEE", font=font(21, bold=True), fill=RED)
    draw.text((750, 459), "CARD DETAILS REQUESTED", font=font(21, bold=True), fill=RED)
    lines(draw, "The pressure is the clue.", 750, 551, 440, 24, MUTED)
    slides.append(canvas)

    # 3: actual hosted on-device result, cropped for legibility.
    canvas, draw = base(3, "Observed on-device check · hosted web demo", "Cropped screenshot of an actual Firebase AI Logic result  •  Chrome stable")
    lines(draw, "A reason to pause,\nwithout sending the\ntext away.", 68, 194, 535, 43, INK, bold=True, leading=1.25)
    lines(draw, "The live checker flagged the urgency and card request.", 70, 427, 510, 25, MUTED)
    draw.rounded_rectangle((70, 548, 511, 602), radius=14, fill="#dfebdf")
    draw.text((88, 561), "INFERENCE SOURCE: ON THIS DEVICE", font=font(18, bold=True), fill=DEEP)
    image_card(canvas, hosted, (648, 155, 542, 481), crop=(1940, 365, 3200, 1290))
    slides.append(canvas)

    # 4: the actual extension result on the same fictional page.
    canvas, draw = base(4, "Actual extension result · requested cloud check", "Composite of real extension DOM screenshots  •  synthetic page  •  source label shown")
    draw.text((69, 141), "The warning appears beside the page.", font=font(31, bold=True), fill=INK)
    image_card(canvas, parcel, (67, 196, 706, 431))
    image_card(canvas, parcel_result, (816, 176, 353, 451), crop=(0, 180, 400, 630))
    draw.rounded_rectangle((899, 594, 1179, 639), radius=12, fill=DEEP)
    draw.text((917, 605), "SOURCE: CLOUD FALLBACK", font=font(17, bold=True), fill=WHITE)
    slides.append(canvas)

    # 5: the second opinion that succeeded after the grounded request hit quota.
    canvas, draw = base(5, "Requested second opinion · honest fallback", "Crop of actual side-panel result  •  no supporting web sources were returned")
    image_card(canvas, fallback, (75, 164, 464, 474), crop=(0, 591, 400, 1092))
    lines(draw, "A second look.\nA clear limit.", 607, 179, 550, 48, INK, bold=True, leading=1.2)
    lines(draw, "The grounded lookup hit the project quota. An ungrounded cloud fallback still explained the warning and advised her to leave the page.", 608, 337, 554, 25, MUTED)
    draw.rounded_rectangle((606, 534, 1190, 613), radius=14, fill="#e9e1d3")
    lines(draw, "NO WEB SOURCES RETURNED — VERIFY DIRECTLY", 627, 552, 550, 18, INK, bold=True)
    slides.append(canvas)

    # 6: bounded evidence, with denominator and limit visible.
    canvas, draw = base(6, "Small synthetic evaluation", "Eight fictional pages  •  one recorded run  •  not a real-world accuracy estimate")
    lines(draw, "We checked both sides.", 72, 166, 1060, 46, INK, bold=True)
    draw.rounded_rectangle((76, 287, 582, 550), radius=22, fill="#f0ded8")
    draw.rounded_rectangle((622, 287, 1128, 550), radius=22, fill="#dceade")
    draw.text((118, 333), "4 / 4", font=font(77, bold=True), fill=RED)
    lines(draw, "suspicious pages\nflagged", 123, 448, 400, 27, INK, bold=True)
    draw.text((666, 333), "0 / 4", font=font(77, bold=True), fill=GREEN)
    lines(draw, "legitimate pages\nfalsely flagged", 672, 448, 410, 27, INK, bold=True)
    slides.append(canvas)

    # 7: give the family a concrete action.
    canvas = Image.new("RGB", (W, H), DEEP)
    image_card(canvas, hero, (0, 0, 595, 720), cover=True, radius=0)
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((595, 0, W, H), fill=DEEP)
    draw.text((654, 80), "THE SAFER NEXT STEP", font=font(19, bold=True), fill="#bed9ca")
    lines(draw, "She stays\nin control.", 651, 137, 580, 57, WHITE, bold=True, leading=1.2)
    for i, label in enumerate(("Close the parcel page.", "Open the official delivery app.", "Call a saved number if unsure."), 1):
        y = 350 + (i - 1) * 80
        draw.ellipse((656, y, 700, y + 44), fill="#dceade")
        draw.text((670, y + 8), str(i), font=font(23, bold=True), fill=DEEP)
        draw.text((717, y + 7), label, font=font(24, bold=True), fill=WHITE)
    draw.text((654, 659), "Illustrative portrait  •  verify independently", font=font(16), fill="#bed9ca")
    slides.append(canvas)

    # 8: source and next click for judges.
    canvas = Image.new("RGB", (W, H), DEEP)
    draw = ImageDraw.Draw(canvas)
    draw.text((74, 77), "SCAM SHIELD", font=font(22, bold=True), fill="#bed9ca")
    lines(draw, "A moment to pause,\nfor someone who matters.", 70, 156, 1120, 58, WHITE, bold=True, leading=1.25)
    draw.line((74, 404, 1195, 404), fill="#8fb6a3", width=2)
    draw.text((74, 456), "TRY THE LIVE CHECKER", font=font(18, bold=True), fill="#bed9ca")
    draw.text((74, 490), "scam-shield-landing-phi.vercel.app", font=font(24, bold=True), fill=WHITE)
    draw.text((74, 559), "SOURCE + SYNTHETIC TEST CASES", font=font(18, bold=True), fill="#bed9ca")
    draw.text((74, 593), "github.com/vdimarco/scam-shield", font=font(24, bold=True), fill=WHITE)
    draw.text((74, 670), "Screenshots are observed results; this video contains no fabricated live footage.", font=font(15), fill="#bed9ca")
    slides.append(canvas)

    return slides


def render():
    slides = build_slides()
    durations = [9, 11, 13, 13, 14, 11, 11, 9]
    transition = 0.4
    with TemporaryDirectory(prefix="scam-shield-video-") as temp:
        paths = []
        for i, slide in enumerate(slides):
            path = Path(temp) / f"slide-{i + 1:02d}.png"
            slide.save(path)
            paths.append(path)
        command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y"]
        for path, duration in zip(paths, durations):
            command += ["-framerate", str(FPS), "-loop", "1", "-t", str(duration), "-i", str(path)]
        chains = []
        offset = durations[0] - transition
        previous = "0:v"
        for i in range(1, len(paths)):
            name = f"v{i}"
            chains.append(f"[{previous}][{i}:v]xfade=transition=fade:duration={transition}:offset={offset:.1f}[{name}]")
            previous = name
            if i < len(paths) - 1:
                offset += durations[i] - transition
        command += ["-filter_complex", ";".join(chains), "-map", f"[{previous}]", "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(OUT)]
        subprocess.run(command, check=True)
    probe = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(OUT)])
    seconds = float(json.loads(probe)["format"]["duration"])
    assert 80 < seconds < 120, f"Unexpected duration: {seconds}"
    print(f"{OUT} ({seconds:.1f} seconds)")


if __name__ == "__main__":
    render()
