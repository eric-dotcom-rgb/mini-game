# Pagani Vs Traffic

Move with your own Pagani Huayra between blue Bugattis and yellow SVJs between the super chaotic traffic scene, beat superbikes on the left lane and use the trucks to slow down the traffic! With 'Pagani Vs traffic' game, you can drive and have fun as much as you want on characteristic Italian motorways, with some of the most lovely NCS songs.
Buon divertimento, pilota!

# How to run and play it

Open `https://eric-dotcom-rgb.github.io/mini-game/` in the browser.

Press 'W' to begin driving. The car starts self accelerating until 60 kmh, then youre on the controls! The car has gauges for engine RPMs and current speed (in km/h). The road is inspired by the classic two-lane double-sided 'autostrada' found commonly around Italy and Europe. The biomes change every few thousand meters to keep the driver focused. Press 'A' and 'D' to turn left or right. To change gears, press a number from 1 to 6. The player car has 6 gears, each limited to a certain speed. The dashboard also shows 3 lives: hitting a traffic car costs one. The distance gauges show the current run and personal record. On the left of the dashboard are the oil and coolant temperatures, labelled in Italian - of course (Pagani is Italian)!
You can also drive listening to 3 of the most beautiful NCS songs, or simply mute it by pressing the button no the top right.

# Controls

The main kayboard keys to use are:
W-accelerate
S-brake
A-move left
D-move right
If you let go the W key, the car decelerates itself, like in real life.
You can change the gears from 1 to 6 simply by pressing the number on you number pad!
1-first gear(max 70 kmh)
2-second gear(max 110 kmh)
3-third gear(max 170 kmh)
4-fourth gear(max 240 kmh)
5-fifth gear(max 310 kmh)
6-sixth gear(max 400 kmh)
Button on top right of the screen: stops music/resumes song

# Credits

1st song: Song: 

Slashtaq & Wanden - Full Speed Ahead [NCS Release]
Music provided by NoCopyrightSounds
Free Download/Stream: http://NCS.io/FullSpeedAhead
Watch: http://youtu.be/USBIGzkFI-Q

2nd song:

Song: Fareoh - Under Water [NCS Release]
Music provided by NoCopyrightSounds
Free Download/Stream: http://ncs.io/UnderWater
Watch: http://youtu.be/xzyRoshFFaA

3rd song:

Song: Cepaque - Alone Tonight
Music provided by NoCopyrightSounds
Free Download/Stream: http://ncs.io/alonetonight
Watch: http://ncs.lnk.to/alonetonightAT/youtube

# Tech Stack

I only made the front-end. No back-end involved, only a progress saving function that is saved in the browser itself.
The project is written in .html, in .css and in Javascript. There are also files using the .png and .mp3 extensions.

# Run locally

Open `index.html` directly, or from the project folder run:

```bash
python -m http.server 8000
```

Then open http://localhost:8000 in your browser.

# General Info

For the car designs and hearts I used 'piskelapp.com'. It took me about 3 1/2 hour-ish to design all of them. The soundtracks used are all credited on '# credits'. It's my first ever project for the Hack Club community and my first time ever coding a full game. Before I used to do some really simple websites in middle school and some scratch, but nothing like this. I firstly used Ai, not knowing how to move around. Then I learned how to do the .html and .css specifically for this game project, so I rewrote everything out of these two files. Then I studied also what the Ai has done on the game.js file, and I added a description to everything in that file so I could sort of tell what was doing what. Then I also added descriptions to the other 2 files, so they were all very clear. I hope I've done a good job! Next project is going to be on godot/unity.