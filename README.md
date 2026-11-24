# PMI-Site-Demo-1-by-RL

Concept demo of a refreshed website for Palacios Marine & Industrial (PMI), by Ross Landry.
**Not the official PMI website.**

**Live:** https://rklglobal.github.io/PMI-Site-Demo-1-by-RL/

**Demo 2 (particle concept):** https://rklglobal.github.io/PMI-Site-Demo-1-by-RL/demo-2/ — refinery objects formed from drifting particles that morph between PMI's disciplines, with hotspot cards and a synthesized pulsing soundtrack. Lives in `demo-2/`.

**Facility Services (photo concept):** https://rklglobal.github.io/PMI-Site-Demo-1-by-RL/facility-services/ — a one-page site for PMI's Facility Services line, built from the facility services flyer. It opens on the plant entrance and flies into the guard house, then the four service lines (janitorial, security, maintenance, grounds) play as full-screen photography, one photo per swipe, followed by service delivery, locations and contact. Photos are AI-generated illustrations with the PMI logo applied, not real PMI job photos. Lives in `facility-services/`.

## What it is (Demo 1)
- Scroll-driven 3D story (Three.js, clean white-model style): a PMI truck hauls pipe down the highway, through the gate, and a crane sets the spool on the pipe rack. Then the camera flies through the plant, one stop per self-performed discipline: Mechanical, Civil, Soft Craft, Industrial Cleaning, Pipeline, Facility Services.
- Standard sections below: capabilities, the PMI advantage, industries, about, core values, locations map, contact. All copy comes from the 2026 PMI digital brochure.
- Procedural sound design (Web Audio, no audio files): ambient score, plant hum, diesel engine tied to truck speed, air brake, crane winch, and UI hover/click sounds. Sound is opt-in on the entry screen and can be toggled bottom-left.

## Files
- `index.html`, `styles.css`, `main.js` (scene + scroll), `audio.js` (sound)
- `vendor/`: Three.js r187 (MIT), served locally
- `assets/`: brochure imagery, PMI logo, self-hosted fonts (Bebas Neue, Inter; SIL OFL)

No build step. To run locally, serve the folder (e.g. `python -m http.server`) and open `index.html`.
