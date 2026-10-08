/** Original encounter-ready creatures. Component names resolve to public canon at seed time. */
export type BestiaryRecipe = {
  key: string;
  name: string;
  environment: string;
  role: string;
  budget: number;
  size: string;
  focus: "physical" | "mental" | "magical";
  ability: string;
  trait: string;
  item?: string;
  concept: string;
  tactics: string;
};
// name | budget | role | size | focus | capability | primitive | item | encounter hook/tactics
const groups: Record<string, string[]> = {
  Wilderness: [
    "Thornpath Jackal|25|Ambusher|SMALL|physical|Driving Blow|Climbing Speed +5||A hungry pack shadows a caravan. Approach along broken roots, strike separated targets, then climb away rather than trading blows.",
    "Mossback Grazer|50|Defender|LARGE|physical|Anchored Stand|Bludgeoning Resistance||A herd blocks the only safe ford. Hold the crossing and protect the young; give intruders space to retreat.",
    "Resinwing Mantis|75|Melee|MEDIUM|physical|Resin Trail|Attack Bonus +2||A resin-coated hunter has marked a forest track. Prepare its trail before committing to a close attack.",
    "Hollowbark Listener|50|Controller|MEDIUM|mental|Stone Alarm|Substrate Echo (Tremorsense 30ft)||A living trunk watches a buried shrine. Use contact-based perception and alarms to draw allies instead of chasing the party.",
    "Briar Covenant Tender|100|Support|MEDIUM|magical|Splint and Rally|Poison Resistance|Rootwork Baton|A forest caretaker defends an injured grove. Support the defender first, then withdraw behind allies when pressed.",
    "Moonspoor Lynx|75|Ambusher|MEDIUM|physical|Still Camouflage|Practice Proficiency||A silent cat hunts around a ruined observatory. Stay concealed until a useful opening; do not treat camouflage as invisibility.",
    "Floodroot Behemoth|250|Solo|HUGE|physical|Stone Rampart|Vitality Core Augment +10||A displaced beast builds barriers across farmland. Use its rampart to divide approaches, then force the party to change position.",
    "Cinderbrush Spitter|100|Ranged|SMALL|magical|Glassfall Spray|Fire Resistance||A scorched nesting ground produces glass-spitting scavengers. Seek a clear firing lane and avoid trapping allies in the spray.",
    "Antlered Routekeeper|150|Controller|LARGE|mental|Shared Route Crossing|Climbing Speed +10||A territorial guardian controls a hazardous woodland passage. Exploit the prepared crossing to reposition companions.",
    "Verdant Pulse Matriarch|400|Solo|HUGE|magical|Spore Choke|Poison Resistance||An ancient fungal colony negotiates through a towering host. Control the approach with its published spore ability; retreat if the colony's heart is threatened.",
  ],
  Subterranean: [
    "Shale Nibbler|25|Melee|TINY|physical|Driving Blow|Burrowing Speed +5||A tunnel scavenger attacks exposed supplies. Burrow between cover and contest food rather than fighting to the death.",
    "Faultglass Scorpion|75|Ambusher|MEDIUM|physical|Driving Blow|Substrate Echo (Tremorsense 30ft)||A translucent hunter waits under a cracked floor. Detect ground contact, emerge at close range, and use the actual driving-blow rules.",
    "Lanternblind Mole|50|Support|SMALL|mental|Groundline Scout|Soil Disturbance Sense||A burrowing scout warns a hidden settlement. Read disturbed earth and guide defenders toward the real intrusion.",
    "Basalt Door Eater|150|Defender|LARGE|physical|Doorway Brace|Burrowing Speed +15||A mineral-feeding creature occupies an abandoned gate. Brace the passage; it values the mineral seam more than a pursuit.",
    "Cavern Choir Bat|75|Controller|SMALL|magical|Harrowing Phrase|Flying Speed +15||A cave flock repeats overheard warnings. Use its phrase at the published range; fly to another ledge after exposure.",
    "Deeprail Rivet Rat|50|Ranged|SMALL|physical|Deliberate Shot|Climbing Speed +10|Archive Dart Tube|An escaped maintenance animal uses scavenged tools. Shoot from railwork and move when a firing position becomes unsafe.",
    "Amber Vault Hermit|100|Support|MEDIUM|mental|Patch the Seam|Cold Resistance|Patchsmith Roll|A caretaker has survived a sealed mine for generations. Repair or support allies within its ability's stated scope, never granting free healing.",
    "Sinkhole Maw|250|Solo|HUGE|physical|Gravity Anchor Trap|Burrowing Speed +30||A tunneling predator has prepared an unstable hunting ground. Use the anchor trap to keep prey near a breach, then approach physically.",
    "Obsidian Recall Spider|150|Controller|LARGE|mental|Mineral Recollection|Psychic Resistance||A stone-reading spider guards evidence of an ancient collapse. Reveal traces through its actual recollection ability and control access with its bulk.",
    "The Mountain's Loose Tooth|625|Solo|GARGANTUAN|physical|Cataclysmic Shockwave|Bludgeoning Resistance||A detached mountain sentinel wakes beneath a city. Telegraph the shockwave and let players use terrain and evacuation routes.",
  ],
  Urban: [
    "Gutterglass Sneak|25|Ambusher|SMALL|physical|Deliberate Disguise|Climbing Speed +5|Seamrunner Knife|A scavenger imitates a courier to enter storehouses. Disguise before contact, escape over walls if discovered.",
    "Bellwatch Hound|50|Defender|MEDIUM|physical|Scent Pursuit|Attack Bonus +2|Animal Cue Whistle|A watch animal follows a particular missing person. Pursue the actual scent and defend its handler rather than identifying guilt magically.",
    "Ledger-Eater Imp|75|Controller|SMALL|mental|The Quiet Compartment|Fire Resistance|Archive Reference Tabs|A record-hoarding nuisance steals contracts. Use its published concealment trick around a hiding place; bargain over documents.",
    "Tinroof Duelist|100|Melee|MEDIUM|physical|Deflecting Blow|Attack Bonus +3|Ledgerguard Saber|A rooftop challenger collects extravagant wagers. Save its defensive ability for a meaningful clash and leave a route for surrender.",
    "Waxseal Witness|50|Support|MEDIUM|mental|Witness Seal|Reason Check +2 below half Vitality|Witness Wax Pellet|A civic construct protects testimony. Preserve a witness and corroborate records instead of becoming an all-knowing lie detector.",
    "Rainspout Artillerist|150|Ranged|MEDIUM|physical|Deliberate Shot|Climbing Speed +20|Watchline Crossbow|A mercenary has fortified a drainage tower. Use elevated cover and the real shot capability; reposition if surrounded.",
    "Velvet Oath Broker|150|Controller|MEDIUM|mental|The Open Door Argument|Psychic Resistance|Pact Boundary Cord|An occult negotiator offers entry to a forbidden district. State terms clearly and apply only the published argumentative ability.",
    "Counterweight Custodian|100|Defender|LARGE|physical|Pocket Barricade|Fixed Anchor Physical Save +2|Counterweight Pavise|A depot guardian protects workers during a riot. Establish cover and make the party choose an alternate approach.",
    "Lamplighter Rescue Moth|75|Support|SMALL|magical|High-Ledge Recovery|Flying Speed +30|Triage Lantern|A guild familiar retrieves stranded residents. Prioritize recovery and shelter, with an exposed route that enemies can threaten.",
    "The Clockhouse Bailiff|400|Solo|LARGE|mental|Temporal Stasis Trap|Save DC +3|Threshold Chime|A municipal enforcer seals a disputed building. Prepare the stasis trap openly enough for investigation and negotiation before confrontation.",
  ],
  Aquatic: [
    "Siltfin Biter|25|Melee|SMALL|physical|Driving Blow|Swimming Speed +5||A river predator follows disturbed sediment. Attack briefly in shallow water and retreat when the shoal is scattered.",
    "Reefglass Needlefish|50|Ranged|SMALL|physical|Return-Catch Throw|Swimming Speed +10||A territorial swimmer flings recovered fragments. Follow the throw ability's range and recovery rules; keep moving along reef cover.",
    "Tidegate Crab|100|Defender|LARGE|physical|Stone Counterbrace|Bludgeoning Resistance||A shell-armored crab nests in a sluice. Brace the choke point and disengage if the gate opens safely.",
    "Brineveil Siren|150|Controller|MEDIUM|mental|Hypnotic Suggester|Psychic Resistance||A shipwreck singer asks travelers to recover a relic. Use the exact suggestion limits; make its request and escape route intelligible.",
    "Airshare Nautilus|75|Support|SMALL|magical|Breath Share|Swimming Speed +20|Airshare Cup|A rescued mollusk carries a breathing apparatus. Share breath through the real capability and become a protection objective.",
    "Drowned Rope Hunter|100|Ambusher|MEDIUM|physical|Line Catch|Water Pressure Sense|Rescue Line Spool|A river scavenger waits among abandoned moorings. Prepare a line and lure prey within the actual catch scope.",
    "Currentglass Ray|150|Ranged|LARGE|magical|Forking Lumen|Lightning Resistance||A luminous ray patrols a charged tidal channel. Use its published lumen ability from clear water and avoid assuming immunity to every electrical hazard.",
    "Abyssal Survey Squid|250|Controller|HUGE|mental|Current Reading|Swimming Speed +20||A deep-water observer tracks a vessel's path. Read currents to anticipate approaches; its large budget does not grant unlisted attacks.",
    "Saltwound Leviathan|625|Solo|GARGANTUAN|physical|Driving Blow|Cold Resistance||A wounded giant blocks a shipping route. Telegraph direct charges and allow the party to treat or divert it.",
    "Pearl Choir Keeper|250|Support|LARGE|magical|Kindly, Collect Yourself|Radiant Resistance|Tide Listener Bowl|A sanctuary keeper protects refugees in a flooded hall. Rally exposed allies and force attackers to navigate the room's existing hazards.",
  ],
  Aerial: [
    "Gustling Kite|25|Support|TINY|mental|Messenger Cue|Flying Speed +15||A signal familiar has lost its courier. Relay its actual cue to allies, staying above ground-level obstacles.",
    "Copperpin Raptor|75|Melee|MEDIUM|physical|Driving Blow|Flying Speed +30||A metal-feathered hunter patrols an airship route. Descend for a close attack and expose itself during the approach.",
    "Cloudglass Harrier|100|Ranged|MEDIUM|magical|Coded Eye Beam|Flying Speed +30||A watch creature signals trespassers above a drifting ruin. Use the beam's actual rules and maintain a visible firing lane.",
    "Stormnest Weaver|150|Controller|LARGE|magical|Tornado Blast|Lightning Resistance||A nest-builder drives travelers from a storm tower. Prepare the blast's access and scope, then use the platform's existing terrain.",
    "Updraft Carapace|100|Defender|LARGE|physical|Shielded Passage|Flying Speed +15||A broad-winged guardian shelters smaller fliers. Escort allies through a contested route rather than granting unlimited protection.",
    "Night Ribbon Glider|75|Ambusher|MEDIUM|physical|Greater Invisibility|Flying Speed +15||A twilight hunter follows a damaged balloon. Apply the real invisibility costs and limitations; reveal clues before its attack.",
    "Wingstitch Chirurgeon|150|Support|MEDIUM|mental|Wing-Catch Descent|Flying Speed +30|Thread Surgeon Needle|A flying medic rescues falling companions. Keep within the descent ability's actual scope and prioritize endangered allies.",
    "Skyhook Corsair|150|Melee|MEDIUM|physical|Return-Catch Throw|Flying Speed +60|Salvager's Hook Shot|An aerial raider boards passing craft. Use a real throwing capability and carried hook gear, with a visible boarding path.",
    "Thunderhead Bastion|400|Defender|HUGE|magical|Stone Rampart|Thunder Resistance||A floating guardian anchors a sheltering wall. Establish its published barrier and let opponents find alternate elevations.",
    "The Weather Vulture|625|Solo|GARGANTUAN|magical|Cataclysmic Shockwave|Flying Speed +60||A vast scavenger follows magical storms. Announce its shockwave before resolution; its flight and size are not free weather control.",
  ],
  Undead: [
    "Candlebone Porter|25|Melee|MEDIUM|physical|Driving Blow|Necrotic Resistance||A tireless porter protects a forgotten delivery. Offer the party a way to fulfill its duty before blades are drawn.",
    "Gravechalk Scout|50|Ambusher|SMALL|mental|Still Camouflage|Substrate Echo (Tremorsense 30ft)||A silent burial-ground watcher blends into stone. Remain still to conceal itself and warn the cemetery's defenders.",
    "Ashwake Mourner|75|Support|MEDIUM|magical|Splint and Rally|Fire Resistance||A restless attendant still protects its former companions. Use the real rally capability, treating undead flavor as narrative rather than extra mechanics.",
    "Ossuary Wallbearer|150|Defender|LARGE|physical|Doorway Brace|Slashing Resistance|Doorbrace Shield|A bone sentinel seals an opened crypt. Hold the doorway and respond to interference with the interred names.",
    "Memorywake Medium|150|Controller|MEDIUM|mental|The Memory Salon|Psychic Resistance|Memory Witness Tile|A dead archivist gathers lost memories. Use the actual memory ability and make recovered information a reason to negotiate.",
    "Rustheart Cavalier|250|Melee|LARGE|physical|Rusting Strike|Piercing Resistance|Counterpoise Glaive|A corroded knight rides an empty parade route. Use its rusting strike against relevant targets and pursue only oath-breakers.",
    "Wickless Beacon|100|Ranged|MEDIUM|magical|Field Beacon|Radiant Resistance|Lastwatch Beacon|An unlit guardian signals dangers in a ruined harbor. Establish the beacon as written and use carried equipment for its actual functions.",
    "Pale Door Passenger|100|Ambusher|MEDIUM|magical|Ghost Walk|Cold Resistance||A ghost repeatedly crosses a sealed threshold. Apply its published traversal limits and reveal the object tethering its routine.",
    "Funeral Bell Chorus|400|Controller|HUGE|mental|Aura of Total Enfeeblement|Save DC +3||A gathered procession overwhelms trespassers near a memorial. Telegraph the aura and honor its stated range and costs.",
    "The Unfinished Monarch|1000|Solo|LARGE|magical|Time Stop|Necrotic Resistance|Oathseal Lens|A sovereign refuses the final moment of its reign. Run Time Stop strictly from its saved rules; offer a resolution through the unfinished oath.",
  ],
  Constructs: [
    "Rivet Courier|25|Support|SMALL|mental|Messenger Route|Climbing Speed +5|Waterproof Dispatch Tube|A workshop messenger carries an urgent order. Use a known route and let the party intercept or protect the dispatch.",
    "Latchjaw Maintenance Unit|50|Melee|SMALL|physical|Scavenged Edge|Poison Resistance|Joining Clamp Gauntlet|A repair unit mistakes equipment for salvage. Apply its actual edge capability and use a work-order override as a negotiation hook.",
    "Prismline Surveyor|75|Ranged|MEDIUM|magical|Coded Eye Beam|Electrical Contact Sense|Survey Slate|A surveying machine marks intruders with its beam. Preserve clear sightlines and follow the published contact-sense scope.",
    "Gateplate Sentinel|150|Defender|LARGE|physical|Plate Exchange|Bludgeoning Resistance|Gatewright Maul|A gate machine shields vulnerable hinges. Use plate exchange as written and expose the machinery's movement route.",
    "Silkgear Patchwright|100|Support|MEDIUM|mental|Patch the Seam|Fire Resistance|Storm Stitch Machine|A delicate automaton repairs a damaged caravan. Protect its work and use only the repair capacity provided by its build.",
    "Magnet Maw Collector|150|Controller|LARGE|magical|Gravity Anchor Trap|Lightning Resistance||A scrap sorter anchors misplaced objects. Prepare its trap and keep magnetism descriptive unless a referenced rule permits more.",
    "Quiet Brass Pursuer|100|Ambusher|MEDIUM|physical|Quiet the Gear|Climbing Speed +10|Night Route Compass|A silent custodian searches for stolen keys. Quiet its actual machinery and climb around defended routes.",
    "Counterlift Atlas|250|Defender|HUGE|physical|Counterweight Lift|Vitality Core Augment +10|Counterturn Winch|A loading machine holds a collapsing freight platform. Use lifting rules and provide a rescue goal beyond destroying it.",
    "Glasswork Verdict Engine|400|Controller|LARGE|mental|Terms in View|Save DC +5|Exact Witness Book|An old civic machine enforces a visible contract. Show the terms to the table and use the real capability rather than automatic compulsion.",
    "The Walking Foundry|1000|Solo|GARGANTUAN|physical|Cataclysmic Shockwave|Fire Resistance|Kilnspine Mace|A wandering foundry seeks fuel in inhabited streets. Telegraph large attacks and let opponents alter its route or fuel supply.",
  ],
  "Arcane anomalies": [
    "Inkblink Remnant|25|Ambusher|TINY|magical|Echo Off the Wall|Climbing Speed +5||A loose spell annotation hides around a library corner. Use the echo capability's actual limits and leave readable traces.",
    "Parallax Familiar|50|Support|SMALL|mental|Aura Detective|Psychic Resistance||An escaped familiar follows a magical signature. Read auras as allowed and help allies distinguish competing trails.",
    "Stillpoint Orb|100|Controller|SMALL|magical|Gravity Anchor Trap|Force Resistance||A laboratory containment orb holds a prepared area. Use the actual anchor trap and make its containment boundary visible.",
    "Prismspill Doppel|150|Ranged|MEDIUM|magical|Forking Lumen|Radiant Resistance||A broken optical experiment throws branching light. Keep its saved lumen scope explicit, avoiding free reflection or duplication.",
    "Foldglass Intruder|150|Ambusher|MEDIUM|magical|Ghost Walk|Save DC +2||A misplaced traveler crosses architecture that no longer matches its map. Respect traversal limits and make escape its primary goal.",
    "Null Choir Node|250|Controller|LARGE|mental|Chamber Blackout Matrix|Thunder Resistance||A failed concert experiment occupies an enclosed chamber. Establish its actual blackout matrix and give opponents clues to its source.",
    "Mnemonic Surgeon|250|Support|MEDIUM|mental|Kindly, Collect Yourself|Reason Check +2 below half Vitality|Thread Surgeon Needle|An experimental caretaker tries to restore distressed subjects. Support allies using its real rally rules and offer conversation before combat.",
    "Splintertime Custodian|400|Defender|LARGE|magical|Temporal Stasis Trap|Cold Resistance||A broken time ward repeats its guard routine. Prepare the stasis trap and let the party learn its repeated route.",
    "The Borrowed Horizon|625|Solo|HUGE|magical|Tornado Blast|Force Resistance||A spatial accident wanders along the edge of an observatory. Use the blast as written; its impossible appearance grants no unlisted teleportation.",
    "Unwritten Reflection|1500|Solo|MEDIUM|magical|Simulacrum|Psychic Resistance||A self-authored reflection wants an independent existence. Resolve Simulacrum from its pinned rules and treat negotiation as a valid encounter outcome.",
  ],
  Infernal: [
    "Cinder Contractling|25|Support|TINY|mental|Witness Seal|Fire Resistance|Witness Wax Pellet|A lesser contract spirit records a disputed promise. Preserve evidence and let literal terms shape its cooperation.",
    "Furnacejaw Runner|75|Melee|MEDIUM|physical|Driving Blow|Fire Resistance||A messenger beast clears an infernal road. Commit to a visible rush and protect the delivery rather than attacking indiscriminately.",
    "Ash Veil Collector|100|Ambusher|MEDIUM|physical|Soot Screen Cast|Necrotic Resistance|Smokework Veil|A debt collector waits in a kiln district. Prepare the actual soot screen and reveal escape paths before its approach.",
    "Brass Oathkeeper|150|Defender|LARGE|physical|Anchored Stand|Lightning Resistance|Oathseal Lens|A gate guardian follows a narrow oath. Anchor at the threshold and make the oath discoverable to clever players.",
    "Sulfur Glass Spitter|150|Ranged|MEDIUM|magical|Glassfall Spray|Acid Resistance||A kiln creature spits cooled slag across a work yard. Use the saved spray rules and avoid automatically adding poison or acid damage.",
    "Chainphrase Advocate|250|Controller|MEDIUM|mental|A Word Behind the Eyes|Save DC +3|Pact Boundary Cord|A persuasive envoy offers safe passage at a cost. Apply its actual mental ability and keep the proposed bargain clear.",
    "Emberfield Tender|100|Support|SMALL|magical|Cooling Interpose|Fire Resistance|Hearthproof Work Apron|An infernal field medic protects workers from a furnace breach. Interpose within its published scope and protect injured allies.",
    "Red Ledger Marshal|400|Controller|LARGE|mental|Vow of Enmity|Psychic Resistance|Exact Witness Book|A marshal hunts a named fugitive through a crowded district. Use the vow as written and distinguish the target from bystanders.",
    "Crown of the Kiln|625|Solo|HUGE|magical|Aura of Total Enfeeblement|Fire Resistance||A ruler's living crown possesses a furnace guardian. Telegraph the enfeeblement aura and expose the scene's physical routes.",
    "The Last Debt|1000|Solo|LARGE|mental|The Uncivil Moment|Necrotic Resistance|Retort Folio|An ancient collector arrives for an impossible payment. Use the actual social capability and make disputing the debt a real objective.",
  ],
  "Ancient guardians": [
    "Threshold Seedling|25|Defender|SMALL|physical|Doorway Brace|Climbing Speed +5||A young ruin guardian blocks a narrow entry. Defend the threshold and let respectful visitors discover a permitted route.",
    "Stone Script Reader|50|Support|MEDIUM|mental|Mineral Recollection|Poison Resistance|Portable Reference Wheel|A monument attendant remembers repairs and visitors. Read stone traces through the actual capability and guide companions toward relevant evidence.",
    "Bronze Path Archer|100|Ranged|MEDIUM|physical|Deliberate Shot|Attack Bonus +2|Survey Bow|A path sentinel watches a ceremonial causeway. Use its published shot from a clear line and stop pursuit at the boundary.",
    "Rootbound Aegis|150|Defender|LARGE|physical|Doorway Brace|Bludgeoning Resistance|Doorbrace Shield|A patient guardian shields an occupied sanctuary. Brace the sanctuary threshold using Doorway Brace, with exposed flanks for the party to exploit.",
    "Veiled Stair Keeper|150|Ambusher|MEDIUM|magical|Greater Invisibility|Climbing Speed +10||A forgotten attendant tests visitors on an ascending stair. Follow invisibility costs and make its trial's goal discoverable.",
    "Ward Choir Archivist|250|Controller|MEDIUM|mental|Harrowing Phrase|Radiant Resistance|Archive Dry Press|An archive guardian recites a warning in several voices. Use the real phrase ability and allow visitors to satisfy the warning.",
    "Gilded Recovery Hand|150|Support|LARGE|magical|Gentle Treatment|Cold Resistance|Graftkeeper Case|A restoration guardian protects injured explorers. Follow the treatment's limits and turn protection of its patients into an encounter objective.",
    "Sunken Observatory Lion|400|Melee|HUGE|physical|Driving Blow|Swimming Speed +20||A flooded observatory's guardian still patrols its halls. Use its swim speed to approach and its saved driving blow at close range.",
    "Equinox Gate Titan|625|Controller|HUGE|magical|Medusa's Gaze|Save DC +5|Skywatch Lens|A gate guardian tests those entering a sealed celestial site. Telegraph the gaze and resolve its published limits rather than automatic petrification.",
    "The First Horizon Warden|1500|Solo|GARGANTUAN|magical|Spell Counter-Disruption Shield|Force Resistance|Arcane Focus|An ancient warden protects a reality anchor. Use its actual counter-disruption shield and offer a way to stabilize the anchor instead of merely defeating it.",
  ],
};
const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
export const systemBestiary: BestiaryRecipe[] = Object.entries(groups).flatMap(
  ([environment, rows]) =>
    rows.map((row) => {
      const [name, budget, role, size, focus, ability, trait, item, story] =
        row.split("|") as [
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
        ];
      return {
        key: slug(name),
        name,
        environment,
        role,
        budget: Number(budget),
        size,
        focus: focus as BestiaryRecipe["focus"],
        ability,
        trait,
        ...(item ? { item } : {}),
        concept: story.split(". ")[0] + ".",
        tactics: story.split(". ").slice(1).join(". "),
      };
    }),
);
