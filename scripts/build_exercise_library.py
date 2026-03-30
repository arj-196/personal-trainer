from __future__ import annotations

import html
import json
import re
import subprocess
import tempfile
import time
import urllib.parse
import urllib.request
from pathlib import Path
from urllib.error import HTTPError

USER_AGENT = "personal-trainer-app/0.1"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
ASSET_ROOT = (
    Path(__file__).resolve().parents[1]
    / "src"
    / "personal_trainer"
    / "assets"
    / "exercise_library"
)
IMAGE_DIR = ASSET_ROOT / "images"
CATALOG_PATH = ASSET_ROOT / "catalog.json"

EXERCISES = [
    {
        "slug": "dumbbell-bench-press",
        "name": "Dumbbell Bench Press",
        "aliases": ["Dumbbell Bench Press"],
        "summary": "A flat press using dumbbells to train chest, shoulders, and triceps.",
        "setup": "Lie on a bench with a dumbbell in each hand and feet planted.",
        "cues": [
            "Lower the bells with elbows slightly tucked.",
            "Press up while keeping shoulder blades pulled into the bench.",
            "Stop just before the elbows fully lock out.",
        ],
        "source_title": "File:Dumbbell-bench-press-1.png",
    },
    {
        "slug": "push-up",
        "name": "Push-Up",
        "aliases": ["Push-Up"],
        "summary": "A bodyweight horizontal press that trains chest, shoulders, triceps, and trunk stiffness.",
        "setup": "Start in a straight-arm plank with hands just outside shoulder width.",
        "cues": [
            "Keep ribs down and glutes tight.",
            "Lower chest and hips together.",
            "Drive the floor away to finish the rep.",
        ],
        "source_title": "File:Push-up-2.png",
    },
    {
        "slug": "pull-ups",
        "name": "Pull-Ups",
        "aliases": ["Pull-Ups"],
        "summary": "A vertical pulling movement for the back and arms using your bodyweight.",
        "setup": "Hang from the bar with a full grip and active shoulders.",
        "cues": [
            "Start by pulling the shoulders down from the ears.",
            "Drive elbows toward your ribs.",
            "Lower under control to a dead hang.",
        ],
        "source_title": "File:Pull-ups exercise from back.jpg",
    },
    {
        "slug": "one-arm-dumbbell-row",
        "name": "1-Arm Dumbbell Row",
        "aliases": ["1-Arm Dumbbell Row"],
        "summary": "A supported rowing pattern for the upper back and lats.",
        "setup": "Brace one hand on a bench or thigh and row the dumbbell with the other arm.",
        "cues": [
            "Keep the torso quiet instead of twisting to move the weight.",
            "Drive the elbow back toward your hip.",
            "Pause briefly at the top and lower slowly.",
        ],
        "visual_note": "The reference image shows the same bent-over row pattern without the one-hand bench support.",
        "source_title": "File:DumbbellBentOverRow.JPG",
    },
    {
        "slug": "seated-dumbbell-shoulder-press",
        "name": "Seated Dumbbell Shoulder Press",
        "aliases": ["Seated Dumbbell Shoulder Press"],
        "summary": "An overhead press variation that biases the shoulders while limiting lower-body momentum.",
        "setup": "Sit tall on a bench with dumbbells at shoulder height.",
        "cues": [
            "Keep forearms vertical at the bottom.",
            "Press overhead without flaring the ribcage.",
            "Finish with biceps near the ears.",
        ],
        "source_title": "File:Dumbbell shoulder press 1.svg",
    },
    {
        "slug": "pike-push-up",
        "name": "Pike Push-Up",
        "aliases": ["Pike Push-Up"],
        "summary": "A bodyweight overhead pressing pattern that shifts load toward the shoulders.",
        "setup": "From downward-dog-like hips, place hands on the floor and aim the head between the hands.",
        "cues": [
            "Keep hips high throughout the rep.",
            "Lower the head in front of the hands, not straight down to the floor.",
            "Push back to the start position.",
        ],
        "visual_note": "The reference image shows a handstand push-up, which is a harder vertical pressing cousin of the pike push-up.",
        "source_title": "File:Handstand pushup.jpg",
    },
    {
        "slug": "rear-delt-raise-on-bench",
        "name": "Chest-Supported Rear Delt Raise",
        "aliases": ["Chest-Supported Rear Delt Raise"],
        "summary": "A rear-shoulder isolation movement performed face-down on a bench.",
        "setup": "Lie chest-down on an incline bench and raise the arms out to the sides.",
        "cues": [
            "Use light weight and soft elbows.",
            "Move from the shoulders, not the lower back.",
            "Pause briefly when the upper arms are level with the torso.",
        ],
        "source_title": "File:Bent over rear deltoid raise with head on bench 1.svg",
    },
    {
        "slug": "plank",
        "name": "Plank",
        "aliases": ["Plank"],
        "summary": "An anti-extension core hold that teaches full-body bracing.",
        "setup": "Set forearms on the floor, elbows under shoulders, and legs straight.",
        "cues": [
            "Squeeze glutes and quads.",
            "Keep a straight line from shoulders to heels.",
            "Breathe behind the brace instead of holding your breath.",
        ],
        "source_title": "File:Plank exercise.svg",
    },
    {
        "slug": "side-plank",
        "name": "Side Plank",
        "aliases": ["Side Plank"],
        "summary": "A lateral core hold that trains obliques and trunk stability.",
        "setup": "Stack feet, place the forearm under the shoulder, and lift hips off the floor.",
        "cues": [
            "Keep ears, shoulders, hips, knees, and ankles in one line.",
            "Push the floor away with the bottom forearm.",
            "Do not let the top shoulder roll forward.",
        ],
        "source_title": "File:Side Plank.jpg",
    },
    {
        "slug": "squat-to-bench",
        "name": "Squat to Bench",
        "aliases": ["Squat to Bench"],
        "summary": "A squat variation that uses a bench as a depth target and control point.",
        "setup": "Stand in front of a bench, sit back under control, then stand back up.",
        "cues": [
            "Reach hips back first.",
            "Keep the full foot connected to the floor.",
            "Lightly touch the bench instead of collapsing onto it.",
        ],
        "source_title": "File:Front squat to bench with barbells 1.svg",
    },
    {
        "slug": "goblet-squat",
        "name": "Goblet Squat",
        "aliases": ["Goblet Squat"],
        "summary": "A squat performed while holding one weight vertically against the chest.",
        "setup": "Hold a dumbbell or kettlebell close to the sternum with elbows pointed down.",
        "cues": [
            "Keep the weight close to your torso.",
            "Sit between the hips while keeping the chest tall.",
            "Drive through the whole foot to stand.",
        ],
        "visual_note": "The image is a still frame from a Wikimedia Commons goblet squat demonstration video.",
        "source_title": "File:Kettlebell Goblet Squat.webm",
        "extract_frame": True,
    },
    {
        "slug": "bodyweight-squat",
        "name": "Bodyweight Squat",
        "aliases": ["Bodyweight Squat"],
        "summary": "A no-load squat pattern used to practice depth, balance, and leg strength.",
        "setup": "Stand around shoulder width and counterbalance with the arms if needed.",
        "cues": [
            "Keep the heels grounded.",
            "Let knees travel naturally as hips bend.",
            "Stand up by driving the floor away.",
        ],
        "source_title": "File:Bodyweight Squats.gif",
        "thumb_width": 500,
    },
    {
        "slug": "dumbbell-romanian-deadlift",
        "name": "Dumbbell Romanian Deadlift",
        "aliases": ["Dumbbell Romanian Deadlift"],
        "summary": "A hip-dominant hinge that trains hamstrings and glutes.",
        "setup": "Hold dumbbells in front of the thighs with knees softly bent.",
        "cues": [
            "Push hips back while the spine stays long.",
            "Keep dumbbells close to the legs.",
            "Stand tall by squeezing glutes at the top.",
        ],
        "source_title": "File:Romanian-deadlift-1.png",
    },
    {
        "slug": "hip-hinge",
        "name": "Hip Hinge",
        "aliases": ["Hip Hinge"],
        "summary": "A drill for learning to bend at the hips while keeping the trunk stable.",
        "setup": "Soften the knees, brace the trunk, and move the hips backward without rounding.",
        "cues": [
            "Think about closing a car door with your hips.",
            "Keep the ribs stacked over the pelvis.",
            "Return by driving the hips forward.",
        ],
        "visual_note": "The reference image is a still frame from a hip-hinge-style kettlebell swing demo, used to show the hinge position.",
        "source_title": "File:Kettlebell Swing Hip Hinge Style.webm",
        "extract_frame": True,
    },
    {
        "slug": "lunge",
        "name": "Lunge",
        "aliases": ["Lunge"],
        "summary": "A split-stance leg exercise for quads, glutes, and balance.",
        "setup": "Take a comfortable stride and lower until both knees bend.",
        "cues": [
            "Keep the front foot flat.",
            "Drop straight down instead of tipping forward.",
            "Push through the front foot to return.",
        ],
        "visual_note": "The CDC reference shows a standard lunge pattern, which is close to the reverse-lunge mechanics used in the plan.",
        "source_title": "File:Lunge-CDC strength training for older adults.gif",
    },
    {
        "slug": "low-step-up",
        "name": "Low Step-Up",
        "aliases": ["Low Step-Up"],
        "summary": "A knee-friendly single-leg exercise using a low step or box.",
        "setup": "Place one full foot on a low step and drive through that leg to stand tall.",
        "cues": [
            "Keep the working foot flat on the step.",
            "Use the top leg to do most of the work.",
            "Lower under control.",
        ],
        "source_title": "File:Step up-CDC strength training for older adults.gif",
    },
    {
        "slug": "glute-bridge",
        "name": "Glute Bridge",
        "aliases": ["Glute Bridge"],
        "summary": "A floor-based hip extension exercise for glutes and hamstrings.",
        "setup": "Lie on your back with knees bent and feet flat, then lift hips.",
        "cues": [
            "Brace before lifting.",
            "Drive through the heels.",
            "Pause at the top without arching the lower back.",
        ],
        "source_title": "File:Glute-bridge.png",
    },
]


def _request(url: str) -> dict:
    for attempt in range(5):
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                return json.load(response)
        except HTTPError as error:
            if error.code != 429 or attempt == 4:
                raise
            retry_after = int(error.headers.get("Retry-After", "10"))
            time.sleep(retry_after)
    raise RuntimeError(f"Failed to fetch {url}")


def _download(url: str, output_path: Path, *, retries: int = 5) -> None:
    for attempt in range(retries):
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                output_path.write_bytes(response.read())
            return
        except HTTPError as error:
            if error.code != 429 or attempt == retries - 1:
                raise
            retry_after = int(error.headers.get("Retry-After", "10"))
            time.sleep(retry_after)


def _extract_frame(video_path: Path, output_path: Path) -> None:
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(video_path),
            "-vf",
            "thumbnail",
            "-frames:v",
            "1",
            str(output_path),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def _strip_html(value: str | None) -> str:
    if not value:
        return ""
    text = re.sub(r"<[^>]+>", "", value)
    return html.unescape(text).strip()


IMAGE_DIR.mkdir(parents=True, exist_ok=True)
catalog = []

for exercise in EXERCISES:
    print(f"Processing {exercise['name']}...")
    params = urllib.parse.urlencode(
        {
            "action": "query",
            "titles": exercise["source_title"],
            "prop": "imageinfo",
            "iiprop": "url|extmetadata",
            "iiurlwidth": exercise.get("thumb_width", 500),
            "format": "json",
        }
    )
    data = _request(f"{COMMONS_API}?{params}")
    page = next(iter(data["query"]["pages"].values()))
    if "missing" in page:
        raise SystemExit(f"Missing source file: {exercise['source_title']}")
    info = page["imageinfo"][0]
    image_url = (
        info["url"]
        if exercise.get("extract_frame")
        else (info.get("thumburl") or info["url"])
    )
    extension = (
        ".jpg"
        if exercise.get("extract_frame")
        else (Path(urllib.parse.urlparse(image_url).path).suffix or ".img")
    )
    output_name = f"{exercise['slug']}{extension}"
    output_path = IMAGE_DIR / output_name
    if not output_path.exists():
        if exercise.get("extract_frame"):
            with tempfile.TemporaryDirectory() as tmpdir:
                temp_video = (
                    Path(tmpdir) / Path(urllib.parse.urlparse(image_url).path).name
                )
                _download(image_url, temp_video)
                _extract_frame(temp_video, output_path)
        else:
            _download(image_url, output_path)

    metadata = info.get("extmetadata", {})
    catalog.append(
        {
            "slug": exercise["slug"],
            "name": exercise["name"],
            "aliases": exercise["aliases"],
            "summary": exercise["summary"],
            "setup": exercise["setup"],
            "cues": exercise["cues"],
            "visual_note": exercise.get("visual_note", ""),
            "image_filename": output_name,
            "source_title": page["title"],
            "source_url": info.get("descriptionurl", ""),
            "author": _strip_html(metadata.get("Artist", {}).get("value")),
            "credit": _strip_html(metadata.get("Credit", {}).get("value")),
            "license": _strip_html(metadata.get("LicenseShortName", {}).get("value")),
            "license_url": metadata.get("LicenseUrl", {}).get("value", ""),
        }
    )
    time.sleep(1.0)

CATALOG_PATH.write_text(json.dumps(catalog, indent=2), encoding="utf-8")
print(f"Wrote {CATALOG_PATH}")
print(f"Downloaded {len(catalog)} exercise images to {IMAGE_DIR}")
