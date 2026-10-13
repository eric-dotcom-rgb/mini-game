# Redline Run

A small top-down, pixel-art Italian motorway driving game. Guide a silver Utopia-inspired hypercar along a divided autostrada with two lanes in each direction. Opposing traffic uses the other carriageway, and roadside signs show Italian motorway speed limits.

## How to play

- Open `index.html` in a browser, or serve the folder locally.
- Steer left and right with the arrow keys or `A` and `D`.
- Press `W` or `↑` to start a run; the car automatically accelerates from 0 to 60 km/h and stays ghosted against traffic until it reaches 60. Select gears with number keys `1`–`6` (maximum speeds: 70, 110, 170, 240, 310, and 380 km/h); hold `W` or `↑` to accelerate and `S` or `↓` to brake down to a minimum of 20 km/h.
- The retro dashboard shows 0–400 km/h and RPM gauges, oil and coolant temperatures, local time, an 18°C simulated outside temperature, gear selection, scores, and lives.
- The car moves closer to the center of the screen while accelerating, then shifts back by about one-third of that distance while braking or coasting.
- On a touch screen, hold the on-screen arrow buttons to steer.
- You can drive onto either paved shoulder and cross the median into oncoming traffic.
- Watch for pixel-art yellow-and-black SVJs, blue Chiron Pur Sports, a red car carrier hauling red and black sports cars (up to 90 km/h), and thin green sport and white cruiser motorcycles. The motorcycles are slower than the sports cars, especially the cruiser, which has a miniature American flag.
- Traffic keeps to the right lane by default. A faster vehicle slows behind slower traffic or the player, moves left to pass only when that lane is clear, then returns right when safe. Vehicles maintain a safe gap instead of overlapping.
- Traffic has its own cruising speed instead of matching your acceleration or braking. You have three hearts; each collision costs one, and losing all three ends the run. Your best distance is saved in the browser.
- Each carriageway has a broad, drivable pixel-art shoulder, about half a lane wide.
- The roadside scenery changes every 600 m: city, canyon, farmland, then mountains. Watch for pixel-art Italian 130 km/h signs.

## Run locally

Open `index.html` directly, or from the project folder run:

```bash
python -m http.server 8000
```

Then open http://localhost:8000 in your browser.
