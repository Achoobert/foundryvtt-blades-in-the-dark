# FoundryVTT Blades in the Dark character and crew sheets

<p align="center">
<img alt="GitHub release (latest by date)" src="https://img.shields.io/github/v/release/dez384/foundryvtt-blades-in-the-dark"> <img alt="GitHub last commit" src="https://img.shields.io/github/last-commit/dez384/foundryvtt-blades-in-the-dark"> <img alt="GitHub All Releases" src="https://img.shields.io/github/downloads/dez384/foundryvtt-blades-in-the-dark/total" /> <img alt="GitHub Release Date" src="https://img.shields.io/github/release-date/dez384/foundryvtt-blades-in-the-dark?label=latest%20release" /> 
</p>
<p align="center">
<img alt="GitHub" src="https://img.shields.io/github/license/dez384/foundryvtt-blades-in-the-dark"> <a href="https://github.com/dez384/foundryvtt-blades-in-the-dark/issues"><img alt="GitHub issues" src="https://img.shields.io/github/issues/dez384/foundryvtt-blades-in-the-dark"></a> <a href="https://github.com/dez384/foundryvtt-blades-in-the-dark/network"><img alt="GitHub forks" src="https://img.shields.io/github/forks/dez384/foundryvtt-blades-in-the-dark"></a> <a href="https://github.com/dez384/foundryvtt-blades-in-the-dark/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/dez384/foundryvtt-blades-in-the-dark"></a> 
</p>

```console
https://github.com/achoobert/foundryvtt-blades-in-the-dark/releases/latest/download/system.json
```
🚧 🚧 🚧 🚧 
WARNING this is a UNOFFICIAL work in progress from an inexperienced dev. 
My goal is to provide nice player-facing sheets and rolls NOT to perfectly model everything in the rulebook!
I seriously doubt this can be merged back into the base blades system at this point, and I'm going to be too busy running games to try. Thus even though I'm keeping it close to the base Blades system this will be a seperate fork for the time being.

If this game system helped you, I may have some games open if you want to play some blades68! 
https://startplaying.games/gm/achoobert
🚧 🚧 🚧 

If you like our work - use the system, use it all, and may the shadows cover your way.
If you have questions, please ask them on the #forged-in-the-dark channel of the [FoundryVTT Discord](https://discord.gg/foundryvtt)

## Usage
`"Item" - all classes, crew types, upgrades, items, abilities, upgrades, etc.`

- All bars can be adjusted by clicking on the box that you want to check. Clicking or right-clicking a checked box will uncheck it.
- To add items you can click a corresponding link or drag items from compendium/game to the sheet.
- To enable Deep Cuts options, use the settings menu.

- To see the description of Class, Vice, Background, etc you can just click added item and see all the info in the popup.
- To add Custom abilities just add a new "Foundry Item" of the corresponding type and fill all the necessary info. Then drag it to the sheet or add via button on a sheet.

I left in the old Blades classes: since 68 is MEANT to be able to cross-play with old playbooks.

## Compendium sources

Compendium data lives as lossless YAML under `yml_source/` (mirrors the Foundry sidebar folders). Generated `packs/*.db` files are build artifacts — not tracked in git.

```console
npm run packs:build
```

Local `npm run watch` / `npm run dev` rebuild packs from YAML before syncing into Foundry. Release workflows build packs before zipping.

## Screenshots
TODO update
### Character Sheet, Crew Sheet and Clock
![alt screen][screenshot_all]

### Compendium
![alt screen][screenshot_compendium]

### Rolls
![alt screen][screenshot_roll_1]
![alt screen][screenshot_roll_2]

## Clocks
- To add clock go to Actors tab and create a new Actor of type "🕛 clock".
- To share it to other players just drag it to a scene.

## Supported Languages
- English
(old translation of old content has not been removed, but is entirely untested)

## Troubleshooting
- If you can't find the drag-n-dropped item, refer to "All Items" tab on each sheet.

## Credits
- This work is based on Blades in the Dark (found at http://www.bladesinthedark.com/), product of One Seven Design, developed and authored by John Harper, and licensed for our use under the Creative Commons Attribution 3.0 Unported license (http://creativecommons.org/licenses/by/3.0/).
- TODO attribute blades68
- TODO attribute trouble engine
- This game system for FoundryVTT was originally made and maintained by Megastruktur (https://github.com/megastruktur/foundryvtt-blades-in-the-dark_)
- Some assets were taken from here (thank you  timdenee and joesinghaus): https://github.com/joesinghaus/Blades-in-the-Dark


[screenshot_all]: ./images/screenshot_all.png "screenshot_all"
[screenshot_compendium]: ./images/screenshot_compendium.png "screenshot_compendium"
[screenshot_roll_1]: ./images/screenshot_roll_1.png "screenshot_roll_1"
[screenshot_roll_2]: ./images/screenshot_roll_2.png "screenshot_roll_2"


text and icons imported from:
https://github.com/Roll20/roll20-character-sheets/tree/master/Blades%2068
under an MIT lisence