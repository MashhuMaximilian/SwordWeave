/** Original item shelf: ordinary gear and bounded fantastic tools, not imported rules. */
export const ITEM_SHELF_ORIGIN = "system:v14:item-shelf:";
export type ShelfItem = {
  name:string; category:string; description:string; primitives:string[]; capabilities:string[]; effects:string[];
  itemType:"WEAPON"|"ARMOR"|"TRINKET"|"ARTIFACT"|"CONSUMABLE";
  size:"TINY"|"SMALL"|"MEDIUM"|"LARGE"; slotCost:number; isTwoHanded:boolean; isConsumable:boolean; isNotEquippable:boolean; iconKey:string;
};
const shelf:ShelfItem[]=[];
function group(category:string, itemType:ShelfItem["itemType"], iconKey:string, records:string, options:Partial<ShelfItem>={}) {
  for(const line of records.trim().split("\n")) {
    const [name,description,p="",c="",e="",flags=""] = line.split("|");
    if(!name||!description)throw new Error(`Incomplete item ${line}`);
    const split=(s:string)=>s.trim()?s.trim().split(";").map(x=>x.trim()):[];
    shelf.push({name,category,description,primitives:split(p),capabilities:split(c),effects:split(e),itemType,iconKey,
      size:"SMALL",slotCost:1,isTwoHanded:false,isConsumable:false,isNotEquippable:false,...options,
      ...(flags.includes("two")?{isTwoHanded:true,slotCost:2,size:"MEDIUM" as const}:{}),
      ...(flags.includes("tiny")?{size:"TINY" as const}:{}),
      ...(flags.includes("large")?{size:"LARGE" as const}:{}),
      ...(flags.includes("carry")?{isNotEquippable:true,slotCost:0}:{}),
    });
  }
}
group("Edges and impact", "WEAPON", "delapouite/sword-brandish", `
Gatewright Maul|A two-handed stoneworker's hammer with a narrow striking face. Inspect an existing seam before striking; it does not reveal weaknesses through solid material.|Breach Survey|Driving Blow||two
Rivetbreaker Pick|A hooked pick for separating accessible plates and fasteners. Its hook requires a reachable joint and cannot open every kind of armor.|Breach Survey|Crack Reader
Ferryhook Spear|A long hook-and-point tool for guarding a landing. Brace only while its butt rests against a firm surface; it does not grant a free attack.|Braced Position|Driving Blow||two
Quarry Wedge Axe|A chopping head with a removable wooden wedge. It cuts suitable material and can hold an opened split; use an ordinary attack for combat.|Driving Strike|Driving Blow
Bellface Cudgel|A hollow bronze club that doubles as a tuned warning bell. Ring it by striking a firm object; its audible warning can also disclose the bearer.|Bell Tuning|Stone Alarm
Seamrunner Knife|A slim knife with a spatula spine for lifting and patching small tears. Its repair use needs compatible material and time.|Temporary Material Patch|Patch the Seam
Counterpoise Glaive|A two-handed blade with a movable balance weight. Its lifting rig works only with an external anchor and suitable carried line.|Rigged Counterweight|Counterweight Lift||two
Waymarker Hatchet|A field hatchet with a shallow stamp for marking a route. Marks remain visible only where the surface and weather preserve them.|Durable Route Marking|Resin Trail
Kilnspine Mace|A heat-tempered mace with a replaceable head. Replacement plates allow a temporary repair between encounters, not automatic restoration during a strike.|Temporary Material Patch|Driving Blow
Tidefork Trident|A two-handed fishing trident carrying shallow flow vanes. Dip it into connected water to read local flow before choosing a crossing.|Ferry Passage Reading|Current Reading||two
Ledgerguard Saber|A plain guard blade with a sealed compartment for a witnessed pact. Its seal records the document's handling and does not compel anyone to honor it.|Witnessed Mark|Driving Blow
Splitgrip Staff|A two-handed staff that divides into two short braces for temporary supports. Reassembly needs both halves and sound joints.|Weather Shelter Frame|Rapid Scaffold||two
`);
group("Bows and launchers", "WEAPON", "carl-olsen/crossbow", `
Survey Bow|A two-handed bow with a sight marked for known field distances. Survey the visible route before a deliberate shot; no unseen target becomes eligible.|Useful Field Map|Deliberate Shot||two
Siltbank Sling|A sling packed with smooth river stones and a waterproof message wrap. It may send a wrapped note across a reachable gap as a table-resolved throw.|Waterproof Message Wrap|Deliberate Shot
Watchline Crossbow|A two-handed crossbow carrying a small signal shutter. Show a rehearsed light code before or after shooting; signaling grants no additional attack.|Visible Signal Code|Deliberate Shot||two
Quarry Harpoon|A two-handed launcher with a detachable safety line. Use an anchored line to catch a willing subject or ordinary load; hostile restraint requires its own resolution.|Anchored Safety Line|Line Catch||two
Canopy Shortbow|A compact bow with a branch cradle. A load-bearing branch can steady preparation, but the shot uses the normal purchased attack and output.|Canopy Footing|Deliberate Shot
Bellbolt Arbalest|A two-handed launcher with a tuned audible mechanism. Prepare a warning on a touched rigid surface before combat; a shot does not automatically trigger that preparation.|Resonant Alarm|Stone Alarm||two
Archive Dart Tube|A small blowpipe and rigid sleeves for transmitting rolled notes. Sleeves keep a dry note intact only within their seal's ordinary limits.|Archive Preservation|Deliberate Shot
Reefline Thrower|A two-handed rope thrower designed to place a light line between ordinary anchors. It cannot lift a load before both ends are secured.|Rigged Counterweight|Counterweight Lift||two
Nightguide Longbow|A two-handed bow with a removable star chart cover. Its travel aid needs visible sky and known landmarks; it adds no automatic attack bonus.|Night Sky Route|Deliberate Shot||two
Crackfinder Javelin|A throwing spear with a narrow inspection mirror in its sheath. Inspect an accessible joint before selecting a shot; the mirror cannot penetrate barriers.|Breach Survey|Crack Reader
Ferry Signal Launcher|A two-handed flare frame with an ordinary hooded lamp. Its visible code identifies a landing to informed observers; it does not illuminate through cover.|Portable Lantern Rig|Field Beacon||two
Salvager's Hook Shot|A two-handed retrieval launcher for light exposed objects. Retrieve only a visible item within the line's reach and rating; creatures are not automatically reeled in.|Small Salvage Recovery|Line Catch||two
`);
group("Guards and armor", "ARMOR", "lorc/breastplate", `
Doorbrace Shield|A shield with a fold-out foot for one named doorway. Activate its brace only while holding the approach; leaving the stance ends the attached save bonus.||Doorway Brace
Patchplate Vest|A vest of removable outer plates. Exchange a damaged plate with compatible spares during a repair interval; no additional DC is implied.||Plate Exchange
Stormfold Mantle|A waxed shoulder covering with two shelter ribs. Its canopy needs support and protects against ordinary rain or hail, not every attack.||Hail Canopy
Anchorback Harness|A wearable rope harness with marked attachment ratings. Secure it to a sound anchor before relying on the safety line.||Line Catch
Smokework Veil|A layered cloth mask for ordinary dust and smoke. Replace clogged cloth; it does not provide oxygen or universal poison immunity.|Ordinary Smoke Filtration
Reef Air Collar|A collar carrying a small sealed air pocket for one stated task. Track remaining air and stop relying on it when the seal opens.||Breath Share
Bridgecall Buckler|A small shield with a whistle and hazard markings. Its call warns listeners about an inspected bridge hazard; it does not stop structural failure.|Bridge Hazard Call
Crackwatch Cuirass|A cuirass lined with inspection guides and replaceable straps. Check its accessible joints and apply temporary repairs with compatible material.|Breach Survey|Patch the Seam
Canopy Wraps|Protective wraps with soft branch grips. They support reachable load-bearing branches; gaps and unstable wood still require normal resolution.|Canopy Footing
Ferryguard Coat|A buoyant-looking coat with clearly marked rope attachments. Its real safety function is the attached line; the coat grants no automatic swim speed.||Line Catch
Testimony Guard Sash|A reinforced sash with sleeves for witnessed records. It preserves recorded terms without deciding whether the speaker was truthful.|Exact Testimony Record;Archive Preservation
Counterweight Pavise|A two-handed portable shield frame with a lifting rig. Set and anchor it before using its counterweight; cover depends on actual placement and material.||Counterweight Lift;Rapid Scaffold||two
`);
group("Travel and traversal", "TRINKET", "lorc/fishing-hook", `
Surveyor's Cord Kit|A marked cord and stakes for surveying one visible route. Lay the line before travel and revise it when the route changes.||Resin Trail
Folded Span Frame|A carried hinged frame for supporting a short improvised passage. Assemble it from available sound materials and state its safe span and load.||Rapid Scaffold||large;carry
Boundary Marker Satchel|A satchel of weather-resistant route markers. Place marks where later travelers can actually see them; possession alone reveals no path.||Resin Trail
Counterweight Pack|A rope-and-pulley kit for lifting ordinary loads. It requires a sound external anchor and never raises personal Carry Capacity.||Counterweight Lift||carry
Night Route Compass|A compass paired with a star slate. Establish direction from visible sky and landmarks, and account for local magnetic interference.|Night Sky Route
Ferry Sounding Pole|A two-handed pole for checking reachable depth and landing hazards. It cannot establish the safety of water beyond its physical reach.|Ferry Passage Reading|| |two
Canopy Safety Belt|A climbing belt with a line and soft branch slings. Secure an actual anchor before catching a willing climber.||Canopy Traverse;Line Catch
Quarry Descent Rack|A carried rack of rope guides and wedges for controlled descent. Inspect the anchor and use the rope's actual length and load rating.||Line Catch||carry
Bridge Inspector's Chain|A short marked chain for comparing visible cracks and gaps. Inspection identifies plausible local hazards, not guaranteed structural safety.|Bridge Hazard Call|Crack Reader
Shelterfinder Roll|A roll of waxed cloth and collapsible poles. Erect ordinary weather cover with stated dimensions before shelter is needed.||Hail Canopy||carry
Salt Road Shoes|Shoes with replaceable soles and a local hazard notebook. Their benefit concerns known salt-route conditions; unfamiliar hazards remain uncertain.|Salt Route Hazard Sense
Water Source Case|A carried sampling kit and map sleeve. Survey a reachable water source; the findings depend on inspection and available evidence.|Water Source Survey|| |carry
`);
group("Signals and scouting", "TRINKET", "lorc/spyglass", `
Shutter Beacon|A hooded lamp with code shutters. Only informed observers with an unobstructed view understand its message.||Hand-Signal Lattice
Stonecall Peg|A rigid peg prepared to transmit one nearby disturbance warning. Set the receiver and signal path before use.||Stone Alarm
Listening Tile|A small contact tile for examining local vibration through a connected rigid surface. Range and obstruction follow the attached capability.||Stone Signal||tiny
Waterline Reader|A submerged vane assembly for reading rough local water movement. Connected water is required and the reading does not identify a creature.||Current Reading
Watchbell Set|A set of small bells tuned to distinguish several ordinary signals. Audible reach depends on the scene and silence defeats the signal.|Bell Tuning
Message Moth Case|A ventilated case with rehearsed messenger cues. A trained creature carries a simple task; travel, hazards, and return remain table-resolved.||Messenger Cue
Waterproof Dispatch Tube|A sealed tube for one fragile message. Water resistance ends when the cap or seal fails; it grants no underwater breathing.|Waterproof Message Wrap
Survey Slate|A wax slate for recording an observed passage and revising it as terrain changes. Its map gives no knowledge of unseen routes.||Surveyed Traverse
Skywatch Lens|An ordinary lens with a night-route chart. Use visible stars and landmarks to guide travel; cloud cover and unfamiliar sky matter.|Night Sky Route
Animal Cue Whistle|A whistle for rehearsed signals understood by a trained animal. It grants no command over unknown or unwilling creatures.|Animal Signal Reading|Messenger Cue
Lantern Moth Hood|A light hood for a trained small messenger's carrier. Signals need an observable light source and a creature able to complete the route.|Portable Lantern Rig|Messenger Cue
Tamper Witness Ribbon|A ribbon marked across a closure in front of witnesses. A broken mark records visible interference without revealing motive or identity.|Witnessed Mark|| |tiny
`);
group("Recovery and rescue", "TRINKET", "delapouite/first-aid-kit", `
Field Splint Case|Splints, clean cloth, and instructions for treating a reachable injured subject. Its attached healing requires successful treatment; roll and modify Vitality manually.||Splint and Rally
Rescue Line Spool|A marked line with a removable anchor hook. Catch a willing subject only within the line's actual length and rating.||Line Catch
Airshare Cup|A cup-shaped breathing aid holding a small bounded air pocket. Agree the task and remaining air; an open seal ends it.||Breath Share
Temporary Stitch Roll|Needles and compatible patch cloth for a small ordinary object. Repairs last only for the stated task and material limit.||Patch the Seam
Rainward Stretcher|A carried rescue frame with a rain hood. Assemble it and state its safe load; its shelter protection covers ordinary weather.||Rapid Scaffold||large;carry
Counterlift Rescue Rig|A carried pulley rig for extracting an ordinary load or willing casualty. Anchor ratings govern the lift and the subject may require separate medical care.||Counterweight Lift;Line Catch||carry
Body Preparation Kit|A respectful kit for stabilizing and preparing an injured or deceased body. It does not resurrect, heal automatically, or remove every consequence.|Careful Body Preparation
Triage Lantern|A hooded lantern and treatment marker set. Provide ordinary visibility while preparing treatment; healing uses the attached manual treatment capability.|Portable Lantern Rig|Splint and Rally
Salvage Basket|A carried basket and pole for recovering small exposed objects from a reachable hazard. Recovery does not establish that the object is safe.|Small Salvage Recovery|| |carry
Cleanwater Sample Box|A carried kit for surveying water before using it in treatment. Test findings depend on evidence; the kit does not purify every contaminant.|Water Source Survey|| |carry
Cold Shelter Wrap|A folding insulated wrap with a weather canopy frame. Prepare cover for the actual exposure; combat protection requires separate resolution.||Hail Canopy
Ration Recovery Tin|A tin of ordinary ingredients and preparation tools for improvising edible rations. Available materials and spoilage govern what can be made.|Improvised Rations
`);
group("Craft and repair", "TRINKET", "lorc/anvil-impact", `
Joining Frame|A carried set of clamps and supports for holding compatible materials together. Its temporary repair has a stated load and failure limit.||Patch the Seam||carry
Saltglass Sample Vials|Sealed tiny vials for preserving small traces or liquids. Record the actual sample and seal condition; preservation is not analysis.|Archive Preservation|||tiny
Fineglass Bench Kit|A carried tool roll for small ordinary glasswork. Suitable glass, heat, preparation, and work time are required.|Fine Glasswork|| |carry
Graftkeeper Case|Cuttings, bindings, and tools for ordinary plant grafting. A compatible living plant and a suitable growth interval are required.|Plant Grafting
Reagent Mortar|A mortar with a marked preparation slate. It prepares known suitable reagents and does not discover every substance's properties.|Reagent Preparation
Patchsmith Roll|A carried roll of compatible fasteners and repair cloth. Patch one reachable ordinary object for a stated task with adequate material.||Patch the Seam||carry
Bellwright Forks|Tuning forks and wedges for preparing ordinary bells and signals. The bearer must reach the instrument and spend the needed work time.|Bell Tuning
Quarry Lift Blocks|A carried set of rated pulley blocks. Rig them to a sound anchor before lifting, and use their actual rating rather than character Carry Capacity.||Counterweight Lift||carry
Archive Dry Press|A carried press and absorbent sheets for preserving fragile records. Wet or damaged material can still lose information.|Archive Preservation|| |carry
Maskmaker's Molds|A carried set of ordinary molds and fitting tools. Make a costume for a chosen role; voice, body, and scrutiny still matter.||Stage Mask Disguise||carry
Breach Survey Mirror|A tiny angled mirror for inspecting reachable seams. It only reveals what the viewing angle and ordinary light permit.||Crack Reader||tiny
Shelterwright Pins|A set of reusable tiny pins for securing an ordinary weather frame. Appropriate fabric and supports are still needed.||Rapid Scaffold||tiny
`);
group("Social and records", "TRINKET", "lorc/scroll-unfurled", `
Oathseal Lens|A lens and witnessed seal kit for examining visible tampering. It records handling evidence and does not expose lies or enforce promises.|Witnessed Mark
Bridge Census Ledger|A ledger for counting households and recording an inspected route. Accuracy depends on testimony and observation.|Household Count;Useful Field Map
Retort Folio|A compact folio of unsettling phrases for a speaker who knows their context. Its attached phrase produces a contextual response rather than compulsory behavior.||Harrowing Phrase
Caravan Hospitality Token|A locally recognized invitation token with a contact ledger. It supports known hospitality customs without forcing entry or goodwill.|Hospitality Network|||tiny
Exact Witness Book|A book of dated verbatim testimony and witness marks. Recording speech establishes what was said, not whether it was true.|Exact Testimony Record;Witnessed Mark
Trade Trace Abacus|A small abacus and ledger guides for tracing recorded exchanges. Missing or false records limit every inference.|Ledger Trace
Stage Mask Set|A fitted mask and costume pieces for one chosen role. Disguise still depends on voice, manner, body, and inspection.||Stage Mask Disguise
Courier Seal Wallet|A wallet for protecting fragile dispatches and recording custody. A damaged seal is evidence of handling rather than certain evidence of theft.|Waterproof Message Wrap;Witnessed Mark
Archive Reference Tabs|Tiny labeled tabs and a reference index for focused research. They help navigate the actual archive and reveal nothing absent from its sources.|Focused Research|||tiny
Pact Boundary Cord|A marked cord placed around a witnessed meeting area. The mark records agreed terms and location without compelling behavior.|Witnessed Mark|Resin Trail
Household Counter Kit|An ordinary counter set and census slate. It supports recording known households and resources, with uncertainty left explicit.|Household Count
Quiet Role Mantle|A reversible costume mantle with quick mask fittings. It supports a plausible role and does not make the bearer invisible.||Stage Mask Disguise
`);
group("Weather and camp", "TRINKET", "lorc/campfire", `
Hearthproof Work Apron|A thick ordinary apron and smoke filter for hearth work. Its filter concerns ordinary particulates, not every fire or toxin.|Ordinary Smoke Filtration
Hailbreak Canopy|A carried canopy frame for preparing shelter against ordinary rain and hail. Set dimensions, supports, and wind limit when erected.||Hail Canopy||large;carry
Weatherwatch Pendants|Small ordinary indicators paired with local observation notes. Forecasts concern recognizable local signs, not certain future events.|Local Weather Reading|||tiny
Ration Weaver Basket|A carried preparation basket for producing ordinary rations from suitable ingredients. It cannot make dangerous material automatically edible.|Improvised Rations|| |carry
Smokeclear Camp Hood|A hood with replaceable filtering cloth. It needs breathable air and fresh cloth; it does not generate oxygen.|Ordinary Smoke Filtration
Ground Test Stakes|Tiny stakes for checking loose ground during salvage work. They reveal reachable soil behavior, not buried treasure or hidden creatures.|Unstable Ground Salvage|||tiny
Waterwatch Camp Case|A carried water-survey case for inspecting an available source before settling camp. Pollution may remain uncertain without suitable evidence.|Water Source Survey|| |carry
Routefire Lantern|A portable hooded lantern and visible signal chart. Use actual line of sight and a rehearsed code to guide approaching travelers.||Hand-Signal Lattice
Dry Record Roll|A waxed roll for preserving camp maps and accounts. Moisture protection depends on its seals and does not repair destroyed text.|Archive Preservation;Waterproof Message Wrap
Stormcall Bell|A bell and local weather notebook for issuing a recognizable warning. The warning communicates an observation without predicting weather with certainty.|Bell Tuning;Local Weather Reading
Ferrycamp Awning|A carried weather frame designed to fit an ordinary landing. Its passage notes concern the observed water and landing conditions.|Ferry Passage Reading|Hail Canopy||carry
Lastwatch Beacon|A hooded camp lamp with a code shutter. A prepared light marks one visible camp location and ends when concealed or extinguished.||Field Beacon
`);
group("Alchemical supplies", "CONSUMABLE", "lorc/potion-ball", `
Glassbreath Flask|A sealed single-use breathing preparation. Use the attached air-sharing capability for one bounded task and manually track the air until spent.||Breath Share
Patchpaste Ampoule|A single-use compatible adhesive and fibers. Patch one small ordinary object for a stated task; excessive strain ends the repair.||Patch the Seam
Rally Dressing|A sealed single-use treatment dressing. Suitable successful treatment may restore the attached 1d4 output; roll and enter the Vitality change manually.||Splint and Rally
Signal Wick|A tiny single-use coded light wick. Ignite it in a visible suitable lamp; informed observers can interpret its code until the wick burns out.||Hand-Signal Lattice||tiny
Witness Wax Pellet|A tiny single-use wax pellet for sealing a witnessed closure. It preserves visible handling evidence without revealing intent.|Witnessed Mark|||tiny
Trail Chalk Capsule|A tiny single-use marking capsule. Place an actual readable route mark; weather and removal can erase it.||Resin Trail||tiny
Reagent Starter Phial|A tiny single-use starter reagent for a known suitable preparation. Its exact use depends on the stated recipe and available materials.|Reagent Preparation|||tiny
Dryleaf Ration Base|A single-use base for improvising ordinary rations with suitable ingredients. It adds no automatic healing or universal food safety.|Improvised Rations
Smoke Filter Sachet|A tiny replaceable particulate sachet. It filters ordinary smoke only while fresh and supplied with breathable air.|Ordinary Smoke Filtration|||tiny
Crack Dye Dropper|A tiny single-use dye for examining an accessible seam. Visible seepage reveals the local joint; it cannot diagnose the whole structure.|Breach Survey|||tiny
Graft Seal Salve|A tiny single-use ordinary sealing preparation for a compatible plant graft. Suitable living plants and a growth interval remain necessary.|Plant Grafting|||tiny
Archive Drying Packet|A tiny single-use packet for stabilizing a damp record. It preserves remaining material but cannot recover lost writing.|Archive Preservation|||tiny
`, {isConsumable:true,isNotEquippable:true,slotCost:0});
group("Attuned tools", "ARTIFACT", "lorc/crystal-wand", `
Splice Rod|A focus carrying separate light-signal and stone-warning recipes. Choose which prepared use is active; each still obeys its own source and signal limits.||Field Beacon;Stone Alarm
Tide Listener Bowl|A shallow focus bowl used in connected water. Its attached reading gives rough local movement and no creature identity.||Current Reading
Rampart Seal|A heavy focus stamp for shaping available stone into a bounded barrier. State dimensions, support, duration, and durability at the table.||Stone Rampart
Echo Locket|A locket with a rigid contact wire. Touch a connected surface to use its short vibration signal; no distant or disconnected sound is revealed.||Stone Signal||tiny
Lastlight Sash|A light-bearing sash whose signal is visible only while uncovered. It provides the beacon recipe without universal invisibility or automatic defense.||Field Beacon
Memory Witness Tile|A portable writing tile with an oathseal edge. Record heard testimony and voluntary terms rather than asserting perfect memory or truth.|Exact Testimony Record;Witnessed Mark
Rootwork Baton|A living-plant work focus and graft bindings. It supports ordinary compatible grafts; growth remains a timed biological process.|Plant Grafting
Crackvoice Reed|A focus reed for inspecting an accessible stone seam and preparing an unsettling phrase. Inspection and speech are separate uses.||Crack Reader;Harrowing Phrase
Airkeeper Orb|A focus holding one bounded breathable pocket for a named task. It cannot provide an unlimited underwater habitat.||Breath Share
Beaconwright Ring|A tiny focus ring with a signal shutter. Produce the attached visible light code where an observer can actually see it.||Field Beacon||tiny
Thread Surgeon Needle|A tiny focus needle with a repair and treatment recipe. Object repair and manual Vitality treatment are separate tasks with suitable supplies.||Patch the Seam;Splint and Rally||tiny
Threshold Chime|A portable focus chime that combines a doorway brace and prepared disturbance warning. Activate only the use that matches the current stance or preparation.||Doorway Brace;Stone Alarm
`);
group("Utility devices", "TRINKET", "lorc/gears", `
Variable Grip Bracer|An adjustable bracer for holding a sound line while braced. The safety use needs an actual anchor and willing subject; grip adjustment creates no extra action.|Braced Position|Line Catch
Joining Clamp Gauntlet|A gauntlet carrying small repair clamps. Suitable material and setup are required before its temporary object repair applies.||Patch the Seam
Counterturn Winch|A carried hand winch for an ordinary rated load. Secure the gear and anchor before lifting; it leaves personal Carry Capacity unchanged.||Counterweight Lift||carry
Splitbeam Lantern|A lamp with separate shutters for several visible codes. It communicates to informed observers without magically duplicating targets or damage.|Portable Lantern Rig|Hand-Signal Lattice
Silt Sampler Arm|A telescoping ordinary sampler for reachable small objects in silt. Its reach and material limits govern recovery; it grants no supernatural sense.|Small Salvage Recovery
Folding Work Screen|A carried work frame for creating ordinary weather cover around a small task. It requires actual cloth and supports and grants no combat immunity.||Rapid Scaffold||large;carry
Messenger Return Box|A ventilated carrier with a rehearsed return cue for a trained animal. The creature's travel and decisions remain table-resolved.||Messenger Cue
Portable Reference Wheel|A compact rotating index of known archive references. Research depends on available sources and what their evidence supports.|Focused Research
Tidegate Probe|A two-handed probe for inspecting reachable water flow and an accessible landing. It cannot judge an unseen whole waterway.|Ferry Passage Reading|Current Reading||two
Witness Camera Frame|An ordinary sketch frame and testimony slate. It helps record what an observer saw and heard without creating photographic certainty.|Exact Testimony Record
Storm Stitch Machine|A carried hand tool for fastening compatible shelter fabric. Its temporary repair and weather cover require material, supports, and preparation.||Patch the Seam;Hail Canopy||carry
Salvage Sorting Tray|A carried tray with labeled sample compartments. Recover and preserve small ordinary traces while recording where they came from.|Small Salvage Recovery;Archive Preservation|| |carry
`);
// New expansion recipes give these carriers actual scoped modifiers or bounded actions.
const additions:Record<string,{p?:string[];c?:string[];text:string}> = {
  "Seamrunner Knife":{c:["Handle Wrap"],text:"Wrap its named handle during preparation for the scoped +1 Attack benefit while the wrap stays intact."},
  "Waymarker Hatchet":{c:["Scavenged Edge"],text:"Its salvaged edge uses the scoped intact-handle Attack bonus only with the named prepared tool."},
  "Counterpoise Glaive":{c:["Deflecting Blow"],text:"Its attached contact maneuver attempts the bounded 5-ft deflection after normal action and save resolution."},
  "Ledgerguard Saber":{c:["Third Beat"],text:"Track its authored two-action rhythm manually before spending the record on an ordinary follow-up."},
  "Crackfinder Javelin":{c:["Return-Catch Throw"],text:"Its returning throw requires a clear legal path and free hand; the return supplies no extra hit."},
  "Survey Bow":{c:["Measured Survey"],text:"Its calibrated sight adds full PB only to its named Fieldcraft measurement task, not to every shot."},
  "Doorbrace Shield":{c:["Shielded Passage"],text:"Holding the named passage in the prepared shield stance raises the one DC by 2; moving or lowering it ends that benefit."},
  "Anchorback Harness":{c:["Anchored Stand"],text:"The attached +2 Physical save applies only while secured to the named intact rated anchor."},
  "Crackwatch Cuirass":{c:["Quiet the Gear"],text:"Pad its reachable fasteners to quiet their ordinary movement until opened, strained, or the padding fails."},
  "Ferryguard Coat":{c:["Float Lash"],text:"A real rated secured float grants the authored +10 Swimming Speed until it detaches or fails."},
  "Counterweight Pavise":{c:["Pocket Barricade"],text:"Place the unfolded panel as actual cover with stated dimensions and approach; the table resolves protection."},
  "Surveyor's Cord Kit":{c:["Measured Survey"],text:"A calibrated cord grants full PB Fieldcraft only during its named measurement task."},
  "Folded Span Frame":{c:["Improvised Span"],text:"The joined supports and rated tether carry only the span and load established during setup."},
  "Canopy Safety Belt":{c:["Belayed Descent"],text:"The named belayed descent grants +2 Physical save only until landing or losing the belay."},
  "Salt Road Shoes":{p:["Rehearsed Route Walking +5"],text:"Following a rehearsed unobstructed route adds 5 walking speed until leaving it or meeting a new obstruction."},
  "Listening Tile":{c:["Groundline Scout"],text:"Hold stationary contact with connected ground for its purchased short-range sense and scoped Awareness bonus."},
  "Animal Cue Whistle":{c:["Messenger Route"],text:"Its messenger task concerns one existing willing small creature and a rehearsed route, with no extra combat turn."},
  "Field Splint Case":{c:["Field Diagnosis"],text:"Turn on its scoped +2 Knowledge only while examining that willing patient's current injury with accessible supplies."},
  "Counterlift Rescue Rig":{p:["Prepared Lift Prowess +PB"],text:"The inspected named rig grants full PB to its lift's Prowess check while its setup remains sound."},
  "Triage Lantern":{c:["Gentle Treatment"],text:"Its reassurance bonus concerns the willing patient during the named treatment; Vitality output remains manual."},
  "Fineglass Bench Kit":{c:["Precision Bench"],text:"During its named uninterrupted fine task the attached effect grants +2 Finesse, ending on interruption."},
  "Joining Frame":{c:["Improvised Span"],text:"Joined parts must form an actual supported short span; materials, tether, and load ratings remain necessary."},
  "Maskmaker's Molds":{c:["Quiet the Gear"],text:"Accessible small mechanisms can be padded quiet until opened, strained, or the padding fails."},
  "Exact Witness Book":{c:["Terms in View"],text:"Its +2 Influence applies only when negotiating the recorded voluntary terms with named witnesses present."},
  "Hearthproof Work Apron":{c:["Ash-Cooling Veil"],text:"Available insulation can be interposed against one stated heat source without granting typed fire immunity."},
  "Rally Dressing":{c:["Dose and Release"],text:"Record one prepared dose and expend it once during ordinary treatment; roll 1d4 healing and modify Vitality manually."},
  "Trail Chalk Capsule":{c:["Scent Pursuit"],text:"This capsule contains scented chalk; track only its identified fresh trail until washed or masked."},
  "Splice Rod":{c:["Forking Lumen"],text:"Its Light delivery divides one rolled d4 total between two purchased legal targets instead of duplicating output."},
  "Echo Locket":{c:["Echo Off the Wall"],text:"Its separate Sound recipe repeats one heard sound at a legal scene point without proving identity."},
  "Memory Witness Tile":{c:["Impression Reading"],text:"Its sustained-touch Sound recipe retains one partial object impression chosen by the table, never complete hidden truth."},
  "Rootwork Baton":{c:["Fuel Quenching"],text:"Carried water can wet one reachable ordinary fuel source until it dries; no water is conjured."},
  "Crackvoice Reed":{c:["Rhythm Breaker"],text:"Its Sound action interrupts one named repeating task with a context-specific consequence and ending event."},
  "Beaconwright Ring":{c:["Drawback Pulse"],text:"A separate Force recipe draws one unattended object of at most 5 lb up to 10 ft along a clear legal path, with movement recorded manually."},
  "Threshold Chime":{c:["Relay Guard"],text:"A normal action can transfer one existing named protection between adjacent willing recipients; end the original and preserve remaining duration."},
  "Splitbeam Lantern":{c:["Forking Lumen"],text:"Its separately resolved Light delivery splits one d4 total between two eligible purchased targets; Vitality stays manual."},
  "Counterturn Winch":{p:["Prepared Lift Prowess +PB"],text:"The named inspected lift gains full PB Prowess only while its sound setup remains intact."},
};
for(const item of shelf){
  const addition=additions[item.name];
  if(addition){item.primitives.push(...addition.p??[]);item.capabilities.push(...addition.c??[]);item.description+=" "+addition.text;}
  if(["Counterlift Rescue Rig","Fineglass Bench Kit","Counterturn Winch"].includes(item.name)){
    item.isNotEquippable=false;item.slotCost=1;
    item.description+=" Equip the kit during this named task so its self modifier can be included by the character-sheet resolver; deactivate the authored condition when the task ends.";
  }
  if(item.itemType==="WEAPON"){
    item.primitives.push(item.isTwoHanded?"Standard Die Block (1d6)":"Minor Die Block",item.category==="Bows and launchers"?"Near Range":"Touch Range");
    item.description+=" Resolve one ordinary purchased attack, roll the attached output die, and change target Vitality manually. The item's physical form determines the described damage type at the table.";
  }
  item.primitives=[...new Set(item.primitives)];item.capabilities=[...new Set(item.capabilities)];
}
const carrierIcons:Array<[RegExp,string]>=[
 [/Maul|Cudgel/,"delapouite/3d-hammer"],[/Pick|Rivet/,"lorc/mining"],[/Axe|Hatchet/,"delapouite/axe-in-log"],[/Knife/,"delapouite/bone-knife"],[/Spear|Javelin|Trident/,"delapouite/spear-feather"],[/Mace/,"delapouite/bone-mace"],[/Staff|Baton/,"delapouite/crescent-staff"],
 [/Shield|Buckler|Pavise/,"sbed/shield"],[/Vest/,"lorc/armor-vest"],[/Mantle|Coat|Sash/,"lucasms/cloak"],[/Line|Spool|Pulley|Counterweight|Winch/,"delapouite/pulley-hook"],[/Lantern|Beacon|Light/,"lorc/lantern"],[/Compass/,"lorc/compass"],[/Whistle/,"delapouite/whistle"],
 [/Book|Ledger|Folio|Reference/,"delapouite/book-cover"],[/Mask/,"delapouite/bat-mask"],[/Abacus|Counter Kit/,"delapouite/abacus"],[/Needle|Stitch/,"lorc/sewing-needle"],[/Vial|Phial|Ampoule/,"sbed/vial"],[/Mortar/,"delapouite/mortar"],[/Basket|Satchel/,"delapouite/basket"],[/Ring/,"delapouite/ring"],[/Slate|Tile|Tablet/,"delapouite/wax-tablet"],[/Pins|Stakes/,"delapouite/pin"],
];
for(const item of shelf)item.iconKey=carrierIcons.find(([pattern])=>pattern.test(item.name))?.[1]??item.iconKey;
export const itemShelf=shelf;
