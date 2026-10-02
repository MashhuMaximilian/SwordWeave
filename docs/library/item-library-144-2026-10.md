# Original 144-item library · 2 October 2026

144 carriers in 12 categories of 12. Item BU is the deduplicated sum of its ingredient recipe, separate from character primitive BU. Suggested prices remain editable. Two-handed items use at least 2 equipment slots. Size governs carried Load separately; carried-only tools and consumables use 0 equipment slots. Tiny supplies use the existing 1000-per-pouch accounting.

The library includes physical utility permissions, scoped bonuses, prepared effects, and magical carrier recipes. A consumable is expended once. Preparation and ending events are stated in the description. Target damage, healing, displacement, and context-specific consequences are resolved and applied manually. Names such as poisoned or slowed do not introduce universal rules.

Design prompts come from the prior 34-game research catalog: portable useful gear from Cairn/Mausritter; material assembly from Zelda/Minecraft; modifying equipment from Warframe/Path of Exile; alternate weapon maneuvers from Monster Hunter; contextual consequences from Fate/Mothership. The names, descriptions, recipes, and numerical choices here are original SwordWeave constructions rather than transcribed text or game rules. See [research provenance](phase4-inspiration-catalog-2026-10.md). Game-icons.net glyphs retain the app's artist attribution and CC BY 3.0 credit.

Expansion dependencies not yet saved: 0.

## Sequence

Run the item seeder dry-run after expansion publication. Apply only after the lineage-image stage, then run the saved-content audit and multi-budget character checks. No character rows are changed by the seeder.

```sh
npx tsx scripts/seed-item-library-144-2026-10.ts
npx tsx scripts/audit-item-library-144-2026-10.ts --design
npx tsx scripts/seed-item-library-144-2026-10.ts --apply
npx tsx scripts/audit-item-library-144-2026-10.ts
```

## Edges and impact

| Item | Item BU | Slots / size | Direct primitives | Capabilities / effects |
|---|---:|---|---|---|
| Gatewright Maul | 10 | 2 / medium / two-handed | Breach Survey, Standard Die Block (1d6), Touch Range | Driving Blow |
| Rivetbreaker Pick | 4 | 1 / small | Breach Survey, Minor Die Block, Touch Range | Crack Reader |
| Ferryhook Spear | 10 | 2 / medium / two-handed | Braced Position, Standard Die Block (1d6), Touch Range | Driving Blow |
| Quarry Wedge Axe | 4 | 1 / small | Driving Strike, Minor Die Block, Touch Range | Driving Blow |
| Bellface Cudgel | 8 | 1 / small | Bell Tuning, Minor Die Block, Touch Range | Stone Alarm |
| Seamrunner Knife | 6 | 1 / small | Temporary Material Patch, Minor Die Block, Touch Range | Patch the Seam, Handle Wrap |
| Counterpoise Glaive | 16 | 2 / medium / two-handed | Rigged Counterweight, Standard Die Block (1d6), Touch Range | Counterweight Lift, Deflecting Blow |
| Waymarker Hatchet | 8 | 1 / small | Durable Route Marking, Minor Die Block, Touch Range | Resin Trail, Scavenged Edge |
| Kilnspine Mace | 8 | 1 / small | Temporary Material Patch, Minor Die Block, Touch Range | Driving Blow |
| Tidefork Trident | 10 | 2 / medium / two-handed | Ferry Passage Reading, Standard Die Block (1d6), Touch Range | Current Reading |
| Ledgerguard Saber | 12 | 1 / small | Witnessed Mark, Minor Die Block, Touch Range | Driving Blow, Third Beat |
| Splitgrip Staff | 6 | 2 / medium / two-handed | Weather Shelter Frame, Standard Die Block (1d6), Touch Range | Rapid Scaffold |

**Gatewright Maul.** A two-handed stoneworker's hammer with a narrow striking face. Inspect an existing seam before striking; it does not reveal weaknesses through solid material. Resolve one ordinary purchased attack, roll the attached output die, and change target Vitality manually. The item's physical form determines the described damage type at the table.

**Rivetbreaker Pick.** A hooked pick for separating accessible plates and fasteners. Its hook requires a reachable joint and cannot open every kind of armor. Resolve one ordinary purchased attack, roll the attached output die, and change target Vitality manually. The item's physical form determines the described damage type at the table.

**Ferryhook Spear.** A long hook-and-point tool for guarding a landing. Brace only while its butt rests against a firm surface; it does not grant a free attack. Resolve one ordinary purchased attack, roll the attached output die, and change target Vitality manually. The item's physical form determines the described damage type at the table.

**Quarry Wedge Axe.** A chopping head with a removable wooden wedge. It cuts suitable material and can hold an opened split; use an ordinary attack for combat. Resolve one ordinary purchased attack, roll the attached output die, and change target Vitality manually. The item's physical form determines the described damage type at the table.

**Bellface Cudgel.** A hollow bronze club that doubles as a tuned warning bell. Ring it by striking a firm object; its audible warning can also disclose the bearer. Resolve one ordinary purchased attack, roll the attached output die, and change target Vitality manually. The item's physical form determines the described damage type at the table.

**Seamrunner Knife.** A slim knife with a spatula spine for lifting and patching small tears. Its repair use needs compatible material and time. Wrap its named handle during preparation for the scoped +1 Attack benefit while the wrap stays intact. Resolve one ordinary purchased attack, roll the attached output die, and change target Vitality manually. The item's physical form determines the described damage type at the table.

**Counterpoise Glaive.** A two-handed blade with a movable balance weight. Its lifting rig works only with an external anchor and suitable carried line. Its attached contact maneuver attempts the bounded 5-ft deflection after normal action and save resolution. Resolve one ordinary purchased attack, roll the attached output die, and change target Vitality manually. The item's physical form determines the described damage type at the table.

**Waymarker Hatchet.** A field hatchet with a shallow stamp for marking a route. Marks remain visible only where the surface and weather preserve them. Its salvaged edge uses the scoped intact-handle Attack bonus only with the named prepared tool. Resolve one ordinary purchased attack, roll the attached output die, and change target Vitality manually. The item's physical form determines the described damage type at the table.

**Kilnspine Mace.** A heat-tempered mace with a replaceable head. Replacement plates allow a temporary repair between encounters, not automatic restoration during a strike. Resolve one ordinary purchased attack, roll the attached output die, and change target Vitality manually. The item's physical form determines the described damage type at the table.

**Tidefork Trident.** A two-handed fishing trident carrying shallow flow vanes. Dip it into connected water to read local flow before choosing a crossing. Resolve one ordinary purchased attack, roll the attached output die, and change target Vitality manually. The item's physical form determines the described damage type at the table.

**Ledgerguard Saber.** A plain guard blade with a sealed compartment for a witnessed pact. Its seal records the document's handling and does not compel anyone to honor it. Track its authored two-action rhythm manually before spending the record on an ordinary follow-up. Resolve one ordinary purchased attack, roll the attached output die, and change target Vitality manually. The item's physical form determines the described damage type at the table.

**Splitgrip Staff.** A two-handed staff that divides into two short braces for temporary supports. Reassembly needs both halves and sound joints. Resolve one ordinary purchased attack, roll the attached output die, and change target Vitality manually. The item's physical form determines the described damage type at the table.

## Bows and launchers

| Item | Item BU | Slots / size | Direct primitives | Capabilities / effects |
|---|---:|---|---|---|
| Survey Bow | 20 | 2 / medium / two-handed | Useful Field Map, Standard Die Block (1d6), Near Range | Deliberate Shot, Measured Survey |
| Siltbank Sling | 10 | 1 / small | Waterproof Message Wrap, Minor Die Block, Near Range | Deliberate Shot |
| Watchline Crossbow | 12 | 2 / medium / two-handed | Visible Signal Code, Standard Die Block (1d6), Near Range | Deliberate Shot |
| Quarry Harpoon | 10 | 2 / medium / two-handed | Anchored Safety Line, Standard Die Block (1d6), Near Range | Line Catch |
| Canopy Shortbow | 12 | 1 / small | Canopy Footing, Minor Die Block, Near Range | Deliberate Shot |
| Bellbolt Arbalest | 10 | 2 / medium / two-handed | Resonant Alarm, Standard Die Block (1d6), Near Range | Stone Alarm |
| Archive Dart Tube | 12 | 1 / small | Archive Preservation, Minor Die Block, Near Range | Deliberate Shot |
| Reefline Thrower | 10 | 2 / medium / two-handed | Rigged Counterweight, Standard Die Block (1d6), Near Range | Counterweight Lift |
| Nightguide Longbow | 14 | 2 / medium / two-handed | Night Sky Route, Standard Die Block (1d6), Near Range | Deliberate Shot |
| Crackfinder Javelin | 16 | 1 / small | Breach Survey, Minor Die Block, Near Range | Crack Reader, Return-Catch Throw |
| Ferry Signal Launcher | 16 | 2 / medium / two-handed | Portable Lantern Rig, Standard Die Block (1d6), Near Range | Field Beacon |
| Salvager's Hook Shot | 14 | 2 / medium / two-handed | Small Salvage Recovery, Standard Die Block (1d6), Near Range | Line Catch |

**Survey Bow.** A two-handed bow with a sight marked for known field distances. Survey the visible route before a deliberate shot; no unseen target becomes eligible. Its calibrated sight adds full PB only to its named Fieldcraft measurement task, not to every shot. Resolve one ordinary purchased attack, roll the attached output die, and change target Vitality manually. The item's physical form determines the described damage type at the table.

**Siltbank Sling.** A sling packed with smooth river stones and a waterproof message wrap. It may send a wrapped note across a reachable gap as a table-resolved throw. Resolve one ordinary purchased attack, roll the attached output die, and change target Vitality manually. The item's physical form determines the described damage type at the table.

**Watchline Crossbow.** A two-handed crossbow carrying a small signal shutter. Show a rehearsed light code before or after shooting; signaling grants no additional attack. Resolve one ordinary purchased attack, roll the attached output die, and change target Vitality manually. The item's physical form determines the described damage type at the table.

**Quarry Harpoon.** A two-handed launcher with a detachable safety line. Use an anchored line to catch a willing subject or ordinary load; hostile restraint requires its own resolution. Resolve one ordinary purchased attack, roll the attached output die, and change target Vitality manually. The item's physical form determines the described damage type at the table.

**Canopy Shortbow.** A compact bow with a branch cradle. A load-bearing branch can steady preparation, but the shot uses the normal purchased attack and output. Resolve one ordinary purchased attack, roll the attached output die, and change target Vitality manually. The item's physical form determines the described damage type at the table.

**Bellbolt Arbalest.** A two-handed launcher with a tuned audible mechanism. Prepare a warning on a touched rigid surface before combat; a shot does not automatically trigger that preparation. Resolve one ordinary purchased attack, roll the attached output die, and change target Vitality manually. The item's physical form determines the described damage type at the table.

**Archive Dart Tube.** A small blowpipe and rigid sleeves for transmitting rolled notes. Sleeves keep a dry note intact only within their seal's ordinary limits. Resolve one ordinary purchased attack, roll the attached output die, and change target Vitality manually. The item's physical form determines the described damage type at the table.

**Reefline Thrower.** A two-handed rope thrower designed to place a light line between ordinary anchors. It cannot lift a load before both ends are secured. Resolve one ordinary purchased attack, roll the attached output die, and change target Vitality manually. The item's physical form determines the described damage type at the table.

**Nightguide Longbow.** A two-handed bow with a removable star chart cover. Its travel aid needs visible sky and known landmarks; it adds no automatic attack bonus. Resolve one ordinary purchased attack, roll the attached output die, and change target Vitality manually. The item's physical form determines the described damage type at the table.

**Crackfinder Javelin.** A throwing spear with a narrow inspection mirror in its sheath. Inspect an accessible joint before selecting a shot; the mirror cannot penetrate barriers. Its returning throw requires a clear legal path and free hand; the return supplies no extra hit. Resolve one ordinary purchased attack, roll the attached output die, and change target Vitality manually. The item's physical form determines the described damage type at the table.

**Ferry Signal Launcher.** A two-handed flare frame with an ordinary hooded lamp. Its visible code identifies a landing to informed observers; it does not illuminate through cover. Resolve one ordinary purchased attack, roll the attached output die, and change target Vitality manually. The item's physical form determines the described damage type at the table.

**Salvager's Hook Shot.** A two-handed retrieval launcher for light exposed objects. Retrieve only a visible item within the line's reach and rating; creatures are not automatically reeled in. Resolve one ordinary purchased attack, roll the attached output die, and change target Vitality manually. The item's physical form determines the described damage type at the table.

## Guards and armor

| Item | Item BU | Slots / size | Direct primitives | Capabilities / effects |
|---|---:|---|---|---|
| Doorbrace Shield | 14 | 1 / small | — | Doorway Brace, Shielded Passage |
| Patchplate Vest | 8 | 1 / small | — | Plate Exchange |
| Stormfold Mantle | 4 | 1 / small | — | Hail Canopy |
| Anchorback Harness | 12 | 1 / small | — | Line Catch, Anchored Stand |
| Smokework Veil | 4 | 1 / small | Ordinary Smoke Filtration | — |
| Reef Air Collar | 8 | 1 / small | — | Breath Share |
| Bridgecall Buckler | 4 | 1 / small | Bridge Hazard Call | — |
| Crackwatch Cuirass | 12 | 1 / small | Breach Survey | Patch the Seam, Quiet the Gear |
| Canopy Wraps | 4 | 1 / small | Canopy Footing | — |
| Ferryguard Coat | 12 | 1 / small | — | Line Catch, Float Lash |
| Testimony Guard Sash | 6 | 1 / small | Exact Testimony Record, Archive Preservation | — |
| Counterweight Pavise | 12 | 2 / medium / two-handed | — | Counterweight Lift, Rapid Scaffold, Pocket Barricade |

**Doorbrace Shield.** A shield with a fold-out foot for one named doorway. Activate its brace only while holding the approach; leaving the stance ends the attached save bonus. Holding the named passage in the prepared shield stance raises the one DC by 2; moving or lowering it ends that benefit.

**Patchplate Vest.** A vest of removable outer plates. Exchange a damaged plate with compatible spares during a repair interval; no additional DC is implied.

**Stormfold Mantle.** A waxed shoulder covering with two shelter ribs. Its canopy needs support and protects against ordinary rain or hail, not every attack.

**Anchorback Harness.** A wearable rope harness with marked attachment ratings. Secure it to a sound anchor before relying on the safety line. The attached +2 Physical save applies only while secured to the named intact rated anchor.

**Smokework Veil.** A layered cloth mask for ordinary dust and smoke. Replace clogged cloth; it does not provide oxygen or universal poison immunity.

**Reef Air Collar.** A collar carrying a small sealed air pocket for one stated task. Track remaining air and stop relying on it when the seal opens.

**Bridgecall Buckler.** A small shield with a whistle and hazard markings. Its call warns listeners about an inspected bridge hazard; it does not stop structural failure.

**Crackwatch Cuirass.** A cuirass lined with inspection guides and replaceable straps. Check its accessible joints and apply temporary repairs with compatible material. Pad its reachable fasteners to quiet their ordinary movement until opened, strained, or the padding fails.

**Canopy Wraps.** Protective wraps with soft branch grips. They support reachable load-bearing branches; gaps and unstable wood still require normal resolution.

**Ferryguard Coat.** A buoyant-looking coat with clearly marked rope attachments. Its real safety function is the attached line; the coat grants no automatic swim speed. A real rated secured float grants the authored +10 Swimming Speed until it detaches or fails.

**Testimony Guard Sash.** A reinforced sash with sleeves for witnessed records. It preserves recorded terms without deciding whether the speaker was truthful.

**Counterweight Pavise.** A two-handed portable shield frame with a lifting rig. Set and anchor it before using its counterweight; cover depends on actual placement and material. Place the unfolded panel as actual cover with stated dimensions and approach; the table resolves protection.

## Travel and traversal

| Item | Item BU | Slots / size | Direct primitives | Capabilities / effects |
|---|---:|---|---|---|
| Surveyor's Cord Kit | 12 | 1 / small | — | Resin Trail, Measured Survey |
| Folded Span Frame | 16 | 0 / large / carried | — | Rapid Scaffold, Improvised Span |
| Boundary Marker Satchel | 2 | 1 / small | — | Resin Trail |
| Counterweight Pack | 4 | 0 / small / carried | — | Counterweight Lift |
| Night Route Compass | 4 | 1 / small | Night Sky Route | — |
| Ferry Sounding Pole | 4 | 2 / medium / two-handed | Ferry Passage Reading | — |
| Canopy Safety Belt | 15 | 1 / small | — | Canopy Traverse, Line Catch, Belayed Descent |
| Quarry Descent Rack | 4 | 0 / small / carried | — | Line Catch |
| Bridge Inspector's Chain | 8 | 1 / small | Bridge Hazard Call | Crack Reader |
| Shelterfinder Roll | 4 | 0 / small / carried | — | Hail Canopy |
| Salt Road Shoes | 6 | 1 / small | Salt Route Hazard Sense, Rehearsed Route Walking +5 | — |
| Water Source Case | 4 | 0 / small / carried | Water Source Survey | — |

**Surveyor's Cord Kit.** A marked cord and stakes for surveying one visible route. Lay the line before travel and revise it when the route changes. A calibrated cord grants full PB Fieldcraft only during its named measurement task.

**Folded Span Frame.** A carried hinged frame for supporting a short improvised passage. Assemble it from available sound materials and state its safe span and load. The joined supports and rated tether carry only the span and load established during setup.

**Boundary Marker Satchel.** A satchel of weather-resistant route markers. Place marks where later travelers can actually see them; possession alone reveals no path.

**Counterweight Pack.** A rope-and-pulley kit for lifting ordinary loads. It requires a sound external anchor and never raises personal Carry Capacity.

**Night Route Compass.** A compass paired with a star slate. Establish direction from visible sky and landmarks, and account for local magnetic interference.

**Ferry Sounding Pole.** A two-handed pole for checking reachable depth and landing hazards. It cannot establish the safety of water beyond its physical reach.

**Canopy Safety Belt.** A climbing belt with a line and soft branch slings. Secure an actual anchor before catching a willing climber. The named belayed descent grants +2 Physical save only until landing or losing the belay.

**Quarry Descent Rack.** A carried rack of rope guides and wedges for controlled descent. Inspect the anchor and use the rope's actual length and load rating.

**Bridge Inspector's Chain.** A short marked chain for comparing visible cracks and gaps. Inspection identifies plausible local hazards, not guaranteed structural safety.

**Shelterfinder Roll.** A roll of waxed cloth and collapsible poles. Erect ordinary weather cover with stated dimensions before shelter is needed.

**Salt Road Shoes.** Shoes with replaceable soles and a local hazard notebook. Their benefit concerns known salt-route conditions; unfamiliar hazards remain uncertain. Following a rehearsed unobstructed route adds 5 walking speed until leaving it or meeting a new obstruction.

**Water Source Case.** A carried sampling kit and map sleeve. Survey a reachable water source; the findings depend on inspection and available evidence.

## Signals and scouting

| Item | Item BU | Slots / size | Direct primitives | Capabilities / effects |
|---|---:|---|---|---|
| Shutter Beacon | 2 | 1 / small | — | Hand-Signal Lattice |
| Stonecall Peg | 4 | 1 / small | — | Stone Alarm |
| Listening Tile | 11 | 1 / tiny | — | Stone Signal, Groundline Scout |
| Waterline Reader | 4 | 1 / small | — | Current Reading |
| Watchbell Set | 4 | 1 / small | Bell Tuning | — |
| Message Moth Case | 4 | 1 / small | — | Messenger Cue |
| Waterproof Dispatch Tube | 2 | 1 / small | Waterproof Message Wrap | — |
| Survey Slate | 6 | 1 / small | — | Surveyed Traverse |
| Skywatch Lens | 4 | 1 / small | Night Sky Route | — |
| Animal Cue Whistle | 16 | 1 / small | Animal Signal Reading | Messenger Cue, Messenger Route |
| Lantern Moth Hood | 8 | 1 / small | Portable Lantern Rig | Messenger Cue |
| Tamper Witness Ribbon | 4 | 1 / tiny | Witnessed Mark | — |

**Shutter Beacon.** A hooded lamp with code shutters. Only informed observers with an unobstructed view understand its message.

**Stonecall Peg.** A rigid peg prepared to transmit one nearby disturbance warning. Set the receiver and signal path before use.

**Listening Tile.** A small contact tile for examining local vibration through a connected rigid surface. Range and obstruction follow the attached capability. Hold stationary contact with connected ground for its purchased short-range sense and scoped Awareness bonus.

**Waterline Reader.** A submerged vane assembly for reading rough local water movement. Connected water is required and the reading does not identify a creature.

**Watchbell Set.** A set of small bells tuned to distinguish several ordinary signals. Audible reach depends on the scene and silence defeats the signal.

**Message Moth Case.** A ventilated case with rehearsed messenger cues. A trained creature carries a simple task; travel, hazards, and return remain table-resolved.

**Waterproof Dispatch Tube.** A sealed tube for one fragile message. Water resistance ends when the cap or seal fails; it grants no underwater breathing.

**Survey Slate.** A wax slate for recording an observed passage and revising it as terrain changes. Its map gives no knowledge of unseen routes.

**Skywatch Lens.** An ordinary lens with a night-route chart. Use visible stars and landmarks to guide travel; cloud cover and unfamiliar sky matter.

**Animal Cue Whistle.** A whistle for rehearsed signals understood by a trained animal. It grants no command over unknown or unwilling creatures. Its messenger task concerns one existing willing small creature and a rehearsed route, with no extra combat turn.

**Lantern Moth Hood.** A light hood for a trained small messenger's carrier. Signals need an observable light source and a creature able to complete the route.

**Tamper Witness Ribbon.** A ribbon marked across a closure in front of witnesses. A broken mark records visible interference without revealing motive or identity.

## Recovery and rescue

| Item | Item BU | Slots / size | Direct primitives | Capabilities / effects |
|---|---:|---|---|---|
| Field Splint Case | 8 | 1 / small | — | Splint and Rally, Field Diagnosis |
| Rescue Line Spool | 4 | 1 / small | — | Line Catch |
| Airshare Cup | 8 | 1 / small | — | Breath Share |
| Temporary Stitch Roll | 4 | 1 / small | — | Patch the Seam |
| Rainward Stretcher | 4 | 0 / large / carried | — | Rapid Scaffold |
| Counterlift Rescue Rig | 14 | 1 / small | Prepared Lift Prowess +PB | Counterweight Lift, Line Catch |
| Body Preparation Kit | 2 | 1 / small | Careful Body Preparation | — |
| Triage Lantern | 12 | 1 / small | Portable Lantern Rig | Splint and Rally, Gentle Treatment |
| Salvage Basket | 4 | 0 / small / carried | Small Salvage Recovery | — |
| Cleanwater Sample Box | 4 | 0 / small / carried | Water Source Survey | — |
| Cold Shelter Wrap | 4 | 1 / small | — | Hail Canopy |
| Ration Recovery Tin | 4 | 1 / small | Improvised Rations | — |

**Field Splint Case.** Splints, clean cloth, and instructions for treating a reachable injured subject. Its attached healing requires successful treatment; roll and modify Vitality manually. Turn on its scoped +2 Knowledge only while examining that willing patient's current injury with accessible supplies.

**Rescue Line Spool.** A marked line with a removable anchor hook. Catch a willing subject only within the line's actual length and rating.

**Airshare Cup.** A cup-shaped breathing aid holding a small bounded air pocket. Agree the task and remaining air; an open seal ends it.

**Temporary Stitch Roll.** Needles and compatible patch cloth for a small ordinary object. Repairs last only for the stated task and material limit.

**Rainward Stretcher.** A carried rescue frame with a rain hood. Assemble it and state its safe load; its shelter protection covers ordinary weather.

**Counterlift Rescue Rig.** A carried pulley rig for extracting an ordinary load or willing casualty. Anchor ratings govern the lift and the subject may require separate medical care. The inspected named rig grants full PB to its lift's Prowess check while its setup remains sound. Equip the kit during this named task so its self modifier can be included by the character-sheet resolver; deactivate the authored condition when the task ends.

**Body Preparation Kit.** A respectful kit for stabilizing and preparing an injured or deceased body. It does not resurrect, heal automatically, or remove every consequence.

**Triage Lantern.** A hooded lantern and treatment marker set. Provide ordinary visibility while preparing treatment; healing uses the attached manual treatment capability. Its reassurance bonus concerns the willing patient during the named treatment; Vitality output remains manual.

**Salvage Basket.** A carried basket and pole for recovering small exposed objects from a reachable hazard. Recovery does not establish that the object is safe.

**Cleanwater Sample Box.** A carried kit for surveying water before using it in treatment. Test findings depend on evidence; the kit does not purify every contaminant.

**Cold Shelter Wrap.** A folding insulated wrap with a weather canopy frame. Prepare cover for the actual exposure; combat protection requires separate resolution.

**Ration Recovery Tin.** A tin of ordinary ingredients and preparation tools for improvising edible rations. Available materials and spoilage govern what can be made.

## Craft and repair

| Item | Item BU | Slots / size | Direct primitives | Capabilities / effects |
|---|---:|---|---|---|
| Joining Frame | 16 | 0 / small / carried | — | Patch the Seam, Improvised Span |
| Saltglass Sample Vials | 4 | 1 / tiny | Archive Preservation | — |
| Fineglass Bench Kit | 8 | 1 / small | Fine Glasswork | Precision Bench |
| Graftkeeper Case | 2 | 1 / small | Plant Grafting | — |
| Reagent Mortar | 4 | 1 / small | Reagent Preparation | — |
| Patchsmith Roll | 4 | 0 / small / carried | — | Patch the Seam |
| Bellwright Forks | 4 | 1 / small | Bell Tuning | — |
| Quarry Lift Blocks | 4 | 0 / small / carried | — | Counterweight Lift |
| Archive Dry Press | 4 | 0 / small / carried | Archive Preservation | — |
| Maskmaker's Molds | 8 | 0 / small / carried | — | Stage Mask Disguise, Quiet the Gear |
| Breach Survey Mirror | 4 | 1 / tiny | — | Crack Reader |
| Shelterwright Pins | 4 | 1 / tiny | — | Rapid Scaffold |

**Joining Frame.** A carried set of clamps and supports for holding compatible materials together. Its temporary repair has a stated load and failure limit. Joined parts must form an actual supported short span; materials, tether, and load ratings remain necessary.

**Saltglass Sample Vials.** Sealed tiny vials for preserving small traces or liquids. Record the actual sample and seal condition; preservation is not analysis.

**Fineglass Bench Kit.** A carried tool roll for small ordinary glasswork. Suitable glass, heat, preparation, and work time are required. During its named uninterrupted fine task the attached effect grants +2 Finesse, ending on interruption. Equip the kit during this named task so its self modifier can be included by the character-sheet resolver; deactivate the authored condition when the task ends.

**Graftkeeper Case.** Cuttings, bindings, and tools for ordinary plant grafting. A compatible living plant and a suitable growth interval are required.

**Reagent Mortar.** A mortar with a marked preparation slate. It prepares known suitable reagents and does not discover every substance's properties.

**Patchsmith Roll.** A carried roll of compatible fasteners and repair cloth. Patch one reachable ordinary object for a stated task with adequate material.

**Bellwright Forks.** Tuning forks and wedges for preparing ordinary bells and signals. The bearer must reach the instrument and spend the needed work time.

**Quarry Lift Blocks.** A carried set of rated pulley blocks. Rig them to a sound anchor before lifting, and use their actual rating rather than character Carry Capacity.

**Archive Dry Press.** A carried press and absorbent sheets for preserving fragile records. Wet or damaged material can still lose information.

**Maskmaker's Molds.** A carried set of ordinary molds and fitting tools. Make a costume for a chosen role; voice, body, and scrutiny still matter. Accessible small mechanisms can be padded quiet until opened, strained, or the padding fails.

**Breach Survey Mirror.** A tiny angled mirror for inspecting reachable seams. It only reveals what the viewing angle and ordinary light permit.

**Shelterwright Pins.** A set of reusable tiny pins for securing an ordinary weather frame. Appropriate fabric and supports are still needed.

## Social and records

| Item | Item BU | Slots / size | Direct primitives | Capabilities / effects |
|---|---:|---|---|---|
| Oathseal Lens | 4 | 1 / small | Witnessed Mark | — |
| Bridge Census Ledger | 8 | 1 / small | Household Count, Useful Field Map | — |
| Retort Folio | 6 | 1 / small | — | Harrowing Phrase |
| Caravan Hospitality Token | 4 | 1 / tiny | Hospitality Network | — |
| Exact Witness Book | 10 | 1 / small | Exact Testimony Record, Witnessed Mark | Terms in View |
| Trade Trace Abacus | 4 | 1 / small | Ledger Trace | — |
| Stage Mask Set | 4 | 1 / small | — | Stage Mask Disguise |
| Courier Seal Wallet | 6 | 1 / small | Waterproof Message Wrap, Witnessed Mark | — |
| Archive Reference Tabs | 4 | 1 / tiny | Focused Research | — |
| Pact Boundary Cord | 6 | 1 / small | Witnessed Mark | Resin Trail |
| Household Counter Kit | 4 | 1 / small | Household Count | — |
| Quiet Role Mantle | 4 | 1 / small | — | Stage Mask Disguise |

**Oathseal Lens.** A lens and witnessed seal kit for examining visible tampering. It records handling evidence and does not expose lies or enforce promises.

**Bridge Census Ledger.** A ledger for counting households and recording an inspected route. Accuracy depends on testimony and observation.

**Retort Folio.** A compact folio of unsettling phrases for a speaker who knows their context. Its attached phrase produces a contextual response rather than compulsory behavior.

**Caravan Hospitality Token.** A locally recognized invitation token with a contact ledger. It supports known hospitality customs without forcing entry or goodwill.

**Exact Witness Book.** A book of dated verbatim testimony and witness marks. Recording speech establishes what was said, not whether it was true. Its +2 Influence applies only when negotiating the recorded voluntary terms with named witnesses present.

**Trade Trace Abacus.** A small abacus and ledger guides for tracing recorded exchanges. Missing or false records limit every inference.

**Stage Mask Set.** A fitted mask and costume pieces for one chosen role. Disguise still depends on voice, manner, body, and inspection.

**Courier Seal Wallet.** A wallet for protecting fragile dispatches and recording custody. A damaged seal is evidence of handling rather than certain evidence of theft.

**Archive Reference Tabs.** Tiny labeled tabs and a reference index for focused research. They help navigate the actual archive and reveal nothing absent from its sources.

**Pact Boundary Cord.** A marked cord placed around a witnessed meeting area. The mark records agreed terms and location without compelling behavior.

**Household Counter Kit.** An ordinary counter set and census slate. It supports recording known households and resources, with uncertainty left explicit.

**Quiet Role Mantle.** A reversible costume mantle with quick mask fittings. It supports a plausible role and does not make the bearer invisible.

## Weather and camp

| Item | Item BU | Slots / size | Direct primitives | Capabilities / effects |
|---|---:|---|---|---|
| Hearthproof Work Apron | 8 | 1 / small | Ordinary Smoke Filtration | Ash-Cooling Veil |
| Hailbreak Canopy | 4 | 0 / large / carried | — | Hail Canopy |
| Weatherwatch Pendants | 4 | 1 / tiny | Local Weather Reading | — |
| Ration Weaver Basket | 4 | 0 / small / carried | Improvised Rations | — |
| Smokeclear Camp Hood | 4 | 1 / small | Ordinary Smoke Filtration | — |
| Ground Test Stakes | 4 | 1 / tiny | Unstable Ground Salvage | — |
| Waterwatch Camp Case | 4 | 0 / small / carried | Water Source Survey | — |
| Routefire Lantern | 2 | 1 / small | — | Hand-Signal Lattice |
| Dry Record Roll | 6 | 1 / small | Archive Preservation, Waterproof Message Wrap | — |
| Stormcall Bell | 8 | 1 / small | Bell Tuning, Local Weather Reading | — |
| Ferrycamp Awning | 8 | 0 / small / carried | Ferry Passage Reading | Hail Canopy |
| Lastwatch Beacon | 6 | 1 / small | — | Field Beacon |

**Hearthproof Work Apron.** A thick ordinary apron and smoke filter for hearth work. Its filter concerns ordinary particulates, not every fire or toxin. Available insulation can be interposed against one stated heat source without granting typed fire immunity.

**Hailbreak Canopy.** A carried canopy frame for preparing shelter against ordinary rain and hail. Set dimensions, supports, and wind limit when erected.

**Weatherwatch Pendants.** Small ordinary indicators paired with local observation notes. Forecasts concern recognizable local signs, not certain future events.

**Ration Weaver Basket.** A carried preparation basket for producing ordinary rations from suitable ingredients. It cannot make dangerous material automatically edible.

**Smokeclear Camp Hood.** A hood with replaceable filtering cloth. It needs breathable air and fresh cloth; it does not generate oxygen.

**Ground Test Stakes.** Tiny stakes for checking loose ground during salvage work. They reveal reachable soil behavior, not buried treasure or hidden creatures.

**Waterwatch Camp Case.** A carried water-survey case for inspecting an available source before settling camp. Pollution may remain uncertain without suitable evidence.

**Routefire Lantern.** A portable hooded lantern and visible signal chart. Use actual line of sight and a rehearsed code to guide approaching travelers.

**Dry Record Roll.** A waxed roll for preserving camp maps and accounts. Moisture protection depends on its seals and does not repair destroyed text.

**Stormcall Bell.** A bell and local weather notebook for issuing a recognizable warning. The warning communicates an observation without predicting weather with certainty.

**Ferrycamp Awning.** A carried weather frame designed to fit an ordinary landing. Its passage notes concern the observed water and landing conditions.

**Lastwatch Beacon.** A hooded camp lamp with a code shutter. A prepared light marks one visible camp location and ends when concealed or extinguished.

## Alchemical supplies

| Item | Item BU | Slots / size | Direct primitives | Capabilities / effects |
|---|---:|---|---|---|
| Glassbreath Flask | 8 | 0 / small / carried / consumable | — | Breath Share |
| Patchpaste Ampoule | 4 | 0 / small / carried / consumable | — | Patch the Seam |
| Rally Dressing | 8 | 0 / small / carried / consumable | — | Splint and Rally, Dose and Release |
| Signal Wick | 2 | 0 / tiny / carried / consumable | — | Hand-Signal Lattice |
| Witness Wax Pellet | 4 | 0 / tiny / carried / consumable | Witnessed Mark | — |
| Trail Chalk Capsule | 12 | 0 / tiny / carried / consumable | — | Resin Trail, Scent Pursuit |
| Reagent Starter Phial | 4 | 0 / tiny / carried / consumable | Reagent Preparation | — |
| Dryleaf Ration Base | 4 | 0 / small / carried / consumable | Improvised Rations | — |
| Smoke Filter Sachet | 4 | 0 / tiny / carried / consumable | Ordinary Smoke Filtration | — |
| Crack Dye Dropper | 4 | 0 / tiny / carried / consumable | Breach Survey | — |
| Graft Seal Salve | 2 | 0 / tiny / carried / consumable | Plant Grafting | — |
| Archive Drying Packet | 4 | 0 / tiny / carried / consumable | Archive Preservation | — |

**Glassbreath Flask.** A sealed single-use breathing preparation. Use the attached air-sharing capability for one bounded task and manually track the air until spent.

**Patchpaste Ampoule.** A single-use compatible adhesive and fibers. Patch one small ordinary object for a stated task; excessive strain ends the repair.

**Rally Dressing.** A sealed single-use treatment dressing. Suitable successful treatment may restore the attached 1d4 output; roll and enter the Vitality change manually. Record one prepared dose and expend it once during ordinary treatment; roll 1d4 healing and modify Vitality manually.

**Signal Wick.** A tiny single-use coded light wick. Ignite it in a visible suitable lamp; informed observers can interpret its code until the wick burns out.

**Witness Wax Pellet.** A tiny single-use wax pellet for sealing a witnessed closure. It preserves visible handling evidence without revealing intent.

**Trail Chalk Capsule.** A tiny single-use marking capsule. Place an actual readable route mark; weather and removal can erase it. This capsule contains scented chalk; track only its identified fresh trail until washed or masked.

**Reagent Starter Phial.** A tiny single-use starter reagent for a known suitable preparation. Its exact use depends on the stated recipe and available materials.

**Dryleaf Ration Base.** A single-use base for improvising ordinary rations with suitable ingredients. It adds no automatic healing or universal food safety.

**Smoke Filter Sachet.** A tiny replaceable particulate sachet. It filters ordinary smoke only while fresh and supplied with breathable air.

**Crack Dye Dropper.** A tiny single-use dye for examining an accessible seam. Visible seepage reveals the local joint; it cannot diagnose the whole structure.

**Graft Seal Salve.** A tiny single-use ordinary sealing preparation for a compatible plant graft. Suitable living plants and a growth interval remain necessary.

**Archive Drying Packet.** A tiny single-use packet for stabilizing a damp record. It preserves remaining material but cannot recover lost writing.

## Attuned tools

| Item | Item BU | Slots / size | Direct primitives | Capabilities / effects |
|---|---:|---|---|---|
| Splice Rod | 32 | 1 / small | — | Field Beacon, Stone Alarm, Forking Lumen |
| Tide Listener Bowl | 4 | 1 / small | — | Current Reading |
| Rampart Seal | 23 | 1 / small | — | Stone Rampart |
| Echo Locket | 23 | 1 / tiny | — | Stone Signal, Echo Off the Wall |
| Lastlight Sash | 6 | 1 / small | — | Field Beacon |
| Memory Witness Tile | 20 | 1 / small | Exact Testimony Record, Witnessed Mark | Impression Reading |
| Rootwork Baton | 4 | 1 / small | Plant Grafting | Fuel Quenching |
| Crackvoice Reed | 26 | 1 / small | — | Crack Reader, Harrowing Phrase, Rhythm Breaker |
| Airkeeper Orb | 8 | 1 / small | — | Breath Share |
| Beaconwright Ring | 24 | 1 / tiny | — | Field Beacon, Drawback Pulse |
| Thread Surgeon Needle | 8 | 1 / tiny | — | Patch the Seam, Splint and Rally |
| Threshold Chime | 18 | 1 / small | — | Doorway Brace, Stone Alarm, Relay Guard |

**Splice Rod.** A focus carrying separate light-signal and stone-warning recipes. Choose which prepared use is active; each still obeys its own source and signal limits. Its Light delivery divides one rolled d4 total between two purchased legal targets instead of duplicating output.

**Tide Listener Bowl.** A shallow focus bowl used in connected water. Its attached reading gives rough local movement and no creature identity.

**Rampart Seal.** A heavy focus stamp for shaping available stone into a bounded barrier. State dimensions, support, duration, and durability at the table.

**Echo Locket.** A locket with a rigid contact wire. Touch a connected surface to use its short vibration signal; no distant or disconnected sound is revealed. Its separate Sound recipe repeats one heard sound at a legal scene point without proving identity.

**Lastlight Sash.** A light-bearing sash whose signal is visible only while uncovered. It provides the beacon recipe without universal invisibility or automatic defense.

**Memory Witness Tile.** A portable writing tile with an oathseal edge. Record heard testimony and voluntary terms rather than asserting perfect memory or truth. Its sustained-touch Sound recipe retains one partial object impression chosen by the table, never complete hidden truth.

**Rootwork Baton.** A living-plant work focus and graft bindings. It supports ordinary compatible grafts; growth remains a timed biological process. Carried water can wet one reachable ordinary fuel source until it dries; no water is conjured.

**Crackvoice Reed.** A focus reed for inspecting an accessible stone seam and preparing an unsettling phrase. Inspection and speech are separate uses. Its Sound action interrupts one named repeating task with a context-specific consequence and ending event.

**Airkeeper Orb.** A focus holding one bounded breathable pocket for a named task. It cannot provide an unlimited underwater habitat.

**Beaconwright Ring.** A tiny focus ring with a signal shutter. Produce the attached visible light code where an observer can actually see it. A separate Force recipe draws one unattended object of at most 5 lb up to 10 ft along a clear legal path, with movement recorded manually.

**Thread Surgeon Needle.** A tiny focus needle with a repair and treatment recipe. Object repair and manual Vitality treatment are separate tasks with suitable supplies.

**Threshold Chime.** A portable focus chime that combines a doorway brace and prepared disturbance warning. Activate only the use that matches the current stance or preparation. A normal action can transfer one existing named protection between adjacent willing recipients; end the original and preserve remaining duration.

## Utility devices

| Item | Item BU | Slots / size | Direct primitives | Capabilities / effects |
|---|---:|---|---|---|
| Variable Grip Bracer | 8 | 1 / small | Braced Position | Line Catch |
| Joining Clamp Gauntlet | 4 | 1 / small | — | Patch the Seam |
| Counterturn Winch | 10 | 1 / small | Prepared Lift Prowess +PB | Counterweight Lift |
| Splitbeam Lantern | 32 | 1 / small | Portable Lantern Rig | Hand-Signal Lattice, Forking Lumen |
| Silt Sampler Arm | 4 | 1 / small | Small Salvage Recovery | — |
| Folding Work Screen | 4 | 0 / large / carried | — | Rapid Scaffold |
| Messenger Return Box | 4 | 1 / small | — | Messenger Cue |
| Portable Reference Wheel | 4 | 1 / small | Focused Research | — |
| Tidegate Probe | 8 | 2 / medium / two-handed | Ferry Passage Reading | Current Reading |
| Witness Camera Frame | 2 | 1 / small | Exact Testimony Record | — |
| Storm Stitch Machine | 8 | 0 / small / carried | — | Patch the Seam, Hail Canopy |
| Salvage Sorting Tray | 8 | 0 / small / carried | Small Salvage Recovery, Archive Preservation | — |

**Variable Grip Bracer.** An adjustable bracer for holding a sound line while braced. The safety use needs an actual anchor and willing subject; grip adjustment creates no extra action.

**Joining Clamp Gauntlet.** A gauntlet carrying small repair clamps. Suitable material and setup are required before its temporary object repair applies.

**Counterturn Winch.** A carried hand winch for an ordinary rated load. Secure the gear and anchor before lifting; it leaves personal Carry Capacity unchanged. The named inspected lift gains full PB Prowess only while its sound setup remains intact. Equip the kit during this named task so its self modifier can be included by the character-sheet resolver; deactivate the authored condition when the task ends.

**Splitbeam Lantern.** A lamp with separate shutters for several visible codes. It communicates to informed observers without magically duplicating targets or damage. Its separately resolved Light delivery splits one d4 total between two eligible purchased targets; Vitality stays manual.

**Silt Sampler Arm.** A telescoping ordinary sampler for reachable small objects in silt. Its reach and material limits govern recovery; it grants no supernatural sense.

**Folding Work Screen.** A carried work frame for creating ordinary weather cover around a small task. It requires actual cloth and supports and grants no combat immunity.

**Messenger Return Box.** A ventilated carrier with a rehearsed return cue for a trained animal. The creature's travel and decisions remain table-resolved.

**Portable Reference Wheel.** A compact rotating index of known archive references. Research depends on available sources and what their evidence supports.

**Tidegate Probe.** A two-handed probe for inspecting reachable water flow and an accessible landing. It cannot judge an unseen whole waterway.

**Witness Camera Frame.** An ordinary sketch frame and testimony slate. It helps record what an observer saw and heard without creating photographic certainty.

**Storm Stitch Machine.** A carried hand tool for fastening compatible shelter fabric. Its temporary repair and weather cover require material, supports, and preparation.

**Salvage Sorting Tray.** A carried tray with labeled sample compartments. Recover and preserve small ordinary traces while recording where they came from.
