export type GuideBlock = {
  title: string;
  body?: string;
  rules?: string[];
  example?: string;
  /** Optional vocabulary, worked examples and analytical detail. */
  details?: GuideBlock[];
};
export type GuideTopic = {
  id: string;
  title: string;
  summary: string;
  keywords: string;
  blocks: GuideBlock[];
  sources?: { title: string; url: string }[];
};

/** Conversation rulings supersede older source examples. Introductory text teaches play; details support reference. */
export const PLAY_GUIDE: GuideTopic[] = [
  {
    "id": "start",
    "title": "Your first game",
    "summary": "A shared story, a character of your own, and a conversation about what happens next.",
    "keywords": "beginner first session how to play ttrpg tabletop game dice dm gm party player intent basics glossary",
    "blocks": [
      {
        "title": "You do not need to know another game",
        "body": "A tabletop roleplaying game is a story you create together. Each player describes what their character says and does. One person, the Dungeon Master (DM, also called the GM), describes the world and plays the people and creatures you encounter. Together you decide what happens. Dice help answer uncertain questions; they do not replace your ideas."
      },
      {
        "title": "Gather your table",
        "body": "Bring a character sheet, a way to roll dice, and people to play with, in person or online. Decide the setting, the kind of adventure you want, and anything you do not want in the story. Ask the DM which starting level or budget to use and whether items have a separate allowance. Agree who will explain the rules as you learn."
      },
      {
        "title": "The DM describes a situation; you describe an intent",
        "body": "An intent is the result you want, spoken normally. You can ask questions about what your character sees before committing. You do not need to name a rule or press an ability button to begin.",
        "example": "DM: “Smoke leaks under the inn’s door. Someone is trapped upstairs.” Player: “Is there a window I can reach? I want to get them out.” DM: “There is a narrow ledge beneath the window, and the ladder is broken.”"
      },
      {
        "title": "Work out what is possible and what is at stake",
        "body": "Show the relevant rules your character owns. Ordinary actions can often be attempted without a special primitive. For an unusual ability, your primitives establish its access. The DM considers reach, strength, complexity and the situation, then explains the attempt’s difficulty, cost and likely consequences. You can accept, reduce the scope or try a different plan.",
        "example": "Player: “I can shape water. Could I draw water from the trough into a path through the smoke?” DM: “A short, maintained passage is possible with your access. Keeping it open takes effort; opening the whole building at once would be much harder.”"
      },
      {
        "title": "Roll only when the outcome needs resolving",
        "body": "The DM tells you whether to roll, which number from your sheet to use, and what success or failure means. Add that bonus to the die result. A DC is the number you need to meet or beat. Something straightforward and uncontested may simply happen.",
        "rules": [
          "d20 means one twenty-sided die. 1d4 means one four-sided die; 4d10 means four ten-sided dice, added together."
        ],
        "example": "The DM asks for a check with your displayed bonus of +5 against DC 12. You roll 9 and add 5: 14 meets the DC. The agreed action succeeds. You do not add the ingredients already included in that +5 a second time."
      },
      {
        "title": "Describe the result and update the sheet",
        "body": "Apply the agreed outcome, cost and consequences. Change current Vitality if needed, record an ongoing effect, and describe the new situation. Another player responds from there. In combat, the whole party plans and resolves a shared round; the Combat rhythm chapter walks through one."
      },
      {
        "title": "A few words you will meet",
        "details": [
          {
            "title": "Party and scene",
            "body": "The party is the group of player characters. A scene is the current situation: a conversation, journey, rescue, fight, or another moment with something at stake."
          },
          {
            "title": "Build Units (BU)",
            "body": "Your budget for acquiring reusable primitives. Buying a primitive and paying the cost of using an action are separate decisions."
          },
          {
            "title": "Vitality, Strain and Cost",
            "body": "Vitality represents health and exertion. Strain describes how hard an attempt pushes the character and the world. Cost is the consequence agreed for doing it: effort, resources, a complication, or another result."
          },
          {
            "title": "Attribute, practice, proficiency and DC",
            "body": "An attribute describes an approach. A practice describes a field of competence. Proficiency is training that adds your Proficiency Bonus (PB). DC is the threshold an opposing roll must meet or beat."
          }
        ]
      },
      {
        "title": "Where to go next",
        "body": "Read Your first character to build a starting sheet, then Primitives, capabilities & effects to understand its pieces. At the table, use the search and topic list as a reference. The optional detail panels explain vocabulary and calculations without making you read all of them before playing."
      }
    ],
    "sources": [
      {
        "title": "Player Loop",
        "url": "https://app.notion.com/p/37fed8479ccd811b9b1cc3a97723dc6e"
      }
    ]
  },
  {
    "id": "first-character",
    "title": "Your first character",
    "summary": "Make someone you want to play, choose a usable foundation, and leave room to grow.",
    "keywords": "beginner creation quickbuild complete name portrait backstory level budget domain verb package weakness random shuffle strengths size",
    "blocks": [
      {
        "title": "Agree a starting point with the DM",
        "body": "Ask what kind of story you are joining and which level or budget to use. Level 1 offers a small set of choices and less room to experiment. Level 3–6 can make a comfortable first adventure; players familiar with other roleplaying games might enjoy level 10. These are suggestions for your table. Level is a useful reference, not a complete measure of power, and 20 is not a maximum."
      },
      {
        "title": "Choose a creation mode",
        "body": "Quickbuild lets you choose ready library foundations. Give the character a name and short backstory, choose level or budget, and add a portrait if you want. Complete character gives more room to describe their personality and history. Both create the same kind of sheet, which you can keep developing."
      },
      {
        "title": "Give the character a simple idea",
        "body": "One sentence is enough to begin: who are they, what are they good at, and what do they want? You can develop their history later. A description tells the table what you imagine; purchased primitives support the special abilities you want to use.",
        "example": "“A small, curious courier who can shape wind and wants to find her missing teacher.” You already have an identity, a useful ability and a reason to go adventuring."
      },
      {
        "title": "Choose strengths and any real drawbacks",
        "body": "Choose the Physical, Mental and Magical spread that suits the concept. The form supplies presets and checks the initial allocation. Attribute proficiency supports related practices and saves. A drawback is optional: read its actual mirrored rule and accept its consequence before using its budget credit. A personality flaw can remain descriptive without granting BU."
      },
      {
        "title": "Choose your heritage foundations",
        "body": "Lineage describes species or ancestry; upbringing describes background and training; manifest describes a role or expression of your build. The Library supplies seeds and examples: you are encouraged to invent your own heritages in the Atelier. You can have multiple lineages, upbringings or manifests when they fit your concept and the table agrees. Quickbuild offers one starting slot for each kind; that form is a starting convenience, not a limit on the character concept. Preview the actual rules and budget before choosing. Heritage names alone do not grant extra abilities."
      },
      {
        "title": "Make sure the foundation can act",
        "body": "You need a verb tier and a domain in your character’s purchased build. A package can provide them, or your chosen heritages may already include them. Items do not satisfy this creation requirement. Touch range and 1d4 are the zero-BU baselines when that category is otherwise absent.",
        "details": [
          {
            "title": "Verb: what kind of change can you make?",
            "body": "A verb tier establishes the permitted kind of action: simple interaction, transformation, or a more involved change. Read its definition; a higher tier is more than a bigger damage number."
          },
          {
            "title": "Domain: what can you work with?",
            "body": "A domain defines the subject, such as Water, Sound or Emotion. It supports actions within that subject and its purchased scope."
          },
          {
            "title": "Range: how far can it reach?",
            "body": "Range access establishes spatial reach. Touch is the free starting baseline. Broader range access must be owned before you use it."
          },
          {
            "title": "Dice type: which output dice can it use?",
            "body": "The die type is an owned output permission: d4, d6, d8 and so on. A dice count, such as four dice rather than one, is a separate scaling choice. More output still increases the action’s pressure."
          }
        ]
      },
      {
        "title": "Leave some BU available",
        "body": "You do not need to spend the entire budget before playing. Spare BU lets you add a useful primitive after you discover what the character needs. You can purchase or invent a primitive mid-session, including during combat when it fits the play and the DM agrees. The new primitive then belongs to your character."
      },
      {
        "title": "Review, create and learn your sheet",
        "body": "Check the names and descriptions, actual rules, required access, remaining BU, drawback credit and separate item total. Discuss any permitted overflow with the DM. Create the character, open the bottom drawer, and find Vitality, attack bonus, DC, saves and practices. Preview your heritages and one capability so you know where their rules are stored."
      }
    ]
  },
  {
    "id": "building-blocks",
    "title": "Primitives, capabilities & effects",
    "summary": "Understand the pieces you own and the ways you assemble them.",
    "keywords": "primitive family fork tier domain verb permission effect capability active passive augment reuse",
    "blocks": [
      {
        "title": "Primitives: the pieces",
        "body": "A primitive is a piece you purchase and keep: a numerical change, permission, resource, or described fictional ability. It can change a number, grant something, or say that your alloyed teeth can bite through plate armor. It does not need a numerical rule to be useful. Families describe a type of primitive and its tiers or scope; forks specialize it into ready choices.",
        "rules": [
          "An authored numerical rule names its result, operation, value, recipient, condition, and stacking behavior."
        ],
        "example": "Attribute Increment is a family. +1 Physical, +3 Physical, and +PB Physical while a stated condition holds are different authored variants. Alloyed teeth that can bite through plate armor may instead be a descriptive permission."
      },
      {
        "title": "Capabilities: saved ideas for quick access",
        "body": "A capability compiles primitives and effects into a convenient idea you can find quickly: a maneuver, gift, active technique, passive feature or augment. Its description says what it is trying to do. You are not limited to the capability cards already saved on the sheet. Use owned primitives to compose a new action on the fly, then save it afterward if you want to use it again.",
        "example": "A saved heat lance is a useful starting point. With the same relevant access, you might instead warm a frozen lock, mark a wall with heat, or propose a blast that also protects allies. Check whether that new intent needs another primitive, then agree its scope and cost."
      },
      {
        "title": "Effects: what happens or persists",
        "body": "An effect describes an outcome or an applied state. It can carry primitives of its own, be included in a capability, and have a duration or conditions for ending. It may change numbers or describe consequences that need interpretation at the table.",
        "example": "Two effects can both be called Poisoned: one represents contaminated food; another represents a shaman’s overwhelming psychedelic. Their consequences can differ. Read the effect and agree what it means here."
      },
      {
        "title": "Scope, conditions, and stacking",
        "body": "Read exactly what a primitive affects. A narrow rule applies only within its authored context; a broad rule covers the stated category. Conditions determine when the rule applies. Stacking determines how contributions to the same result combine: some keep every contribution, while others retain only the highest, lowest, or another specified result. A condition is part of the authored primitive. The app can read numerical states automatically; a contextual condition such as “while tracking enemies” needs the appropriate manual state or override.",
        "example": "A +1 Awareness fork while tracking is different from +1 Awareness everywhere. If a rule sets a minimum or maximum, it constrains the result rather than acting as another ordinary bonus."
      },
      {
        "title": "Read the two kinds of description",
        "body": "Mechanical rules appear in orange. Narrative and descriptive text remains in the normal text color. Read both: the numbers tell you what changes, while the description explains what the character actually does."
      },
      {
        "title": "Reuse what you own",
        "body": "You purchase primitives. Capabilities, effects, and heritages organize them. Reusing an already owned primitive in another composition does not buy it again. A shared primitive should appear once in the mechanical summary; distinct numerical forks remain distinct rules.",
        "example": "If you own primitive X worth 10 BU, adding a 40 BU capability containing that same X costs 30 additional BU, provided the remaining ingredients are new purchases."
      }
    ],
    "sources": [
      {
        "title": "Capability Composition Map",
        "url": "https://app.notion.com/p/37fed8479ccd810dbd98e4c942a98553"
      }
    ]
  },
  {
    "id": "heritages",
    "title": "Heritages & your build",
    "summary": "Lineage, upbringing, and manifest give your concept a foundation.",
    "keywords": "heritage lineage species race upbringing background manifest class size quickbuild package character creation",
    "blocks": [
      {
        "title": "Lineage",
        "body": "Your species or ancestry: the body, senses, and inherited qualities that shape your character. A lineage has a starting size. Quickbuild uses that size; size primitives can change it later."
      },
      {
        "title": "Upbringing",
        "body": "Your background: where and how you grew up, learned, worked, or survived. It can supply training, knowledge, contacts, and practical abilities."
      },
      {
        "title": "Manifest",
        "body": "Your main build or expression: the role and capabilities around which you currently shape the character. It is a foundation you can develop, not a fixed progression track."
      },
      {
        "title": "Keep placement flexible",
        "body": "Place purchased pieces wherever they make sense for your concept. Wings might be part of one character’s lineage and another’s manifest or capability. You can develop the character during play, including purchasing a primitive mid-combat when the table permits it."
      },
      {
        "title": "Create, then develop",
        "body": "Complete creation gives you room for a detailed concept. Quickbuild helps you choose ready heritages, strengths, and a short backstory; packages, drawbacks, and items are optional additions. Both create a sheet you can keep editing.",
        "rules": [
          "Creation requires a verb tier and a domain through your character build or package. Items do not satisfy that requirement.",
          "When the corresponding category is absent, the zero-BU Touch range and 1d4 baseline are granted."
        ],
        "example": "Choose a small lineage, a caravan upbringing, and a protective manifest. Later, add a new sense or technique without replacing that original concept."
      }
    ]
  },
  {
    "id": "budget",
    "title": "BU, mirrors & progression",
    "summary": "Purchase reusable primitives; track items and drawback credit separately.",
    "keywords": "budget bu debt overflow dm bonus progression level mirror weakness drawback cost ownership",
    "blocks": [
      {
        "title": "BU is your build budget",
        "body": "Build Units (BU) are the budget used to acquire primitives. Acquiring a piece commits part of that budget; it does not charge BU again each time you use it. Published prices are authored choices informed by tier guidelines. Characters begin with a 25-BU foundation; higher-level or custom-budget creation includes the agreed progression allowance as well."
      },
      {
        "title": "Mirroring changes direction; drawbacks carry consequences",
        "body": "You own the primitive, whether acquired normally or as a mirrored drawback. Compatible operations can be used in either direction within an action or composition without buying the primitive again: add/subtract, minimum/maximum, multiply/divide, and other supported mirrors. A drawback gives credit because the character accepts its ongoing consequence. Using a positive direction in a separate action does not silently remove that drawback from the character’s build.",
        "example": "You own +10 Max Vitality. You can propose an action that applies −10 Max Vitality to an enemy for an agreed duration. You still need the appropriate action and domain access, reach, resolution and cost. A character who acquired the mirrored version can also propose either direction; their accepted personal drawback remains accounted for.",
        "details": [
          {
            "title": "All mechanical operations and their mirrors",
            "body": "These pairs describe the operation of a compatible mechanical rule. Check its target, scope, value and permissions as well. A narrative rule needs its intended opposite agreed at the table; reversing a word does not automatically grant new access.",
            "rules": [
              "Add ↔ Subtract — mirrorable. Increase a value becomes decrease that value, and vice versa.",
              "Multiply ↔ Divide — mirrorable. A proportional increase can become a proportional reduction; inspect the displayed mirrored rule and factor.",
              "Minimum ↔ Maximum — mirrorable. A floor becomes a ceiling at the same value, and vice versa.",
              "Grant ↔ Revoke — mirrorable. Give a permission or behavior becomes remove it, and vice versa, within the rule’s scope.",
              "Set To — not mirrorable. Assigning a fixed value or state has no automatic opposite. Write another rule if you need a different assignment."
            ],
            "example": "A minimum roll of 10 can mirror into a maximum roll of 10. Granting a named behavior can mirror into revoking that same behavior. A rule that sets a score to 10 does not automatically mean “set it to −10” when mirrored."
          }
        ]
      },
      {
        "title": "Read the budget ledger",
        "body": "Creation separates purchases, drawback credit, and overflow. It fills the normal budget first, then uses drawback credit, then records any remaining overflow. Going over the normal allowance needs the DM’s agreement; creation cannot exceed the next-level ceiling or the permitted drawback debt.",
        "example": "With 60 BU available, 10 BU drawback credit, and 76 BU purchased, the ledger uses 60 normal BU + 10 credit + 6 overflow. Ask the DM about that overflow before finishing."
      },
      {
        "title": "Items have a separate budget",
        "body": "Item BU does not consume the normal character build budget. Your DM may set a separate item allowance. Their primitives are still usable in play through the item, including in combinations, while the item’s availability and rules apply."
      },
      {
        "title": "Grow through BU awards",
        "body": "The DM awards Build Units as rewards for discoveries, milestones, accomplishments or other campaign progress, whenever your group agrees it makes sense. Awards can be smaller than a whole level: they accumulate toward progression. In the default progression, each ordinary level requires another 10 BU. Spend awarded BU immediately or keep it for later; spending your budget does not undo your progression. Every four levels, reaching the next bracket also grants an automatic milestone spike on level-up: at levels 5, 9, 13, 17 and onward. This spike is added to the usual 10-BU step, not substituted for the DM’s progression reward. Levels are a shorthand, with no level-20 cap.",
        "details": [
          {
            "title": "Read the progression thresholds",
            "body": "The current reference is 25 BU at level 1, 35 at level 2, 45 at level 3 and 55 at level 4. Level 5 is 69, level 9 is 117, level 13 is 169 and level 17 is 225. These totals already include their milestone bonuses; do not add those bonuses again. Level 10 is 127 and level 21 is 286. The sheet continues the progression beyond those milestones. Your table can agree a different budget or a DM adjustment."
          }
        ],
        "example": "At level 4, the reference budget is 55 BU. The DM awards another 10 BU of progression, bringing you to level 5. Level 5 also grants its default +4 BU spike, so the new total is 69 BU. You do not need to earn that spike separately. It is already included in the sheet’s level-5 reference; do not add it again."
      },
      {
        "title": "Versions preserve your build",
        "body": "A saved character may pin an older published version. A later library revision does not silently rewrite that character. Review an update before adopting it."
      }
    ],
    "sources": [
      {
        "title": "Leveling & Progression",
        "url": "https://app.notion.com/p/37fed8479ccd80fba08bc88bb715658a"
      }
    ]
  },
  {
    "id": "rolls",
    "title": "Attributes, practices, attacks & saves",
    "summary": "One DC, three saving throws, and proficiency only where it applies.",
    "keywords": "roll d20 dc physical mental magical practice skill proficiency pb expertise attack saving throw round up",
    "blocks": [
      {
        "title": "Attributes describe how you approach a problem",
        "body": "Your three attributes provide the broad foundation of checks, attacks and saves. Choose an approach that fits what you are actually doing, then use its current sheet total. Physical, Psychic (Mental) and Magical source types help identify the approach of an authored capability.",
        "details": [
          {
            "title": "Physical — body and material action",
            "body": "Strength, coordination, endurance and physical execution. Use it for bodily effort: holding a falling gate, moving carefully across a ledge, or enduring a physical threat."
          },
          {
            "title": "Mental — thought, attention and social agency",
            "body": "Observation, reasoning, learning and deliberate communication. Use it for studying evidence, planning a mechanism, negotiating, or resisting an attack on the mind."
          },
          {
            "title": "Magical — supernatural sensitivity and expression",
            "body": "Working with magical, spiritual and unusual forces. Use it for interpreting a strange working, relating to supernatural beings, or responding to a magical threat. Its precise expression follows the character and world."
          }
        ]
      },
      {
        "title": "Checks and practices",
        "body": "Practices describe reliable competence, not a list of things you are allowed to try. Anyone can attempt an ordinary action; training improves the roll.",
        "rules": [
          "Check = d20 + relevant attribute + PB if trained + applicable modifiers."
        ],
        "example": "For tracking enemies, Fieldcraft may apply. If you are trained, add PB; add a narrow tracking bonus only when its authored condition is satisfied."
      },
      {
        "title": "Practices describe areas of competence",
        "body": "You can attempt ordinary actions without a trained practice. Training improves the relevant roll. Read the following examples as guidance for choosing an approach, not as a closed list of permitted actions.",
        "details": [
          {
            "title": "Prowess · Physical",
            "body": "Bodily force, athletic exertion and endurance. Lift a beam, wrestle a captor, climb through brute effort, or keep moving under a heavy burden."
          },
          {
            "title": "Finesse · Physical",
            "body": "Precision, balance and controlled movement. Cross a narrow ledge, handle a delicate mechanism, move discreetly, or perform a careful physical task."
          },
          {
            "title": "Fieldcraft · Physical",
            "body": "Practical knowledge of terrain, travel and survival. Track footprints, find a safe campsite, predict a local hazard, navigate wilderness, or stabilize an injured companion."
          },
          {
            "title": "Awareness · Mental",
            "body": "Attention to what is observable now. Notice a concealed movement, hear approaching steps, spot an unsafe ledge, or monitor the details of a crowded room."
          },
          {
            "title": "Reason · Mental",
            "body": "Analysis and problem solving from evidence. Reconstruct how a device failed, compare clues, diagnose a technical problem, or test an explanation."
          },
          {
            "title": "Knowledge · Mental",
            "body": "Learning, memory and research. Recall a historical event, identify a familiar symbol, explain a studied subject, or find useful information in records."
          },
          {
            "title": "Influence · Mental",
            "body": "Deliberate communication and social presentation. Negotiate, persuade, command attention, intimidate, perform, or earn trust. The situation and the other person’s motives still matter."
          },
          {
            "title": "Mysticism · Magical",
            "body": "Understanding magical forces and structures. Interpret a ritual, investigate supernatural interference, recognize a magical pattern, or study how an unusual working functions."
          },
          {
            "title": "Communion · Magical",
            "body": "Relationship and attunement with living, ecological, spiritual or sacred systems. Read the state of a grove, communicate through an appropriate connection, or work with a spirit. Training alone does not grant every communication permission."
          },
          {
            "title": "Intuition · Magical",
            "body": "Sensitivity to motives, emotion, resonance and incomplete patterns. Sense that an encounter feels wrong, interpret an omen, or notice a hidden emotional current. An impression is a clue rather than guaranteed knowledge."
          }
        ]
      },
      {
        "title": "Proficiency and expertise",
        "body": "Base PB starts at +2 at level 1 and increases by 1 every four levels: +3 at level 5, +4 at level 9, and so on. Active PB primitives can modify the value. Proficiency adds PB to the relevant trained check; expertise uses twice PB where the grant applies and requires the corresponding proficiency."
      },
      {
        "title": "Attacks: use your displayed bonus",
        "body": "For an attack, roll d20 and add the applicable attack bonus shown on your sheet against the target’s DC. Meet or beat that DC to hit, then roll or resolve damage separately. A miss does not deal the hit’s damage unless a specific rule says otherwise. For a capability that subjects a target to an effect through a saving throw, the target instead rolls the relevant save against your DC. Choose Physical, Mental or Magical according to the capability’s source; read its specific resolution and agreed outcome before rolling. Do not require both an attack and a save by default: the capability or table ruling determines the resolution.",
        "rules": [
          "Attack = d20 + relevant attribute + PB if applicable + attack modifiers."
        ],
        "example": "You roll 11 with a displayed +6 attack bonus against DC 15. The total is 17, so the attack meets the threshold. Resolve its damage or effect, apply resistance if appropriate, then update the recipient’s Vitality or consequences."
      },
      {
        "title": "Roll bias",
        "body": "Baseline advantage rolls two resolution dice and keeps the higher; disadvantage keeps the lower. These change the roll behavior, not its static bonus. Read the authored scope and the sheet’s bias counters when several rules apply; do not assume each icon is another numerical +1."
      },
      {
        "title": "One DC",
        "body": "The character has one DC for attacks and effects to resolve against. There are no separate Physical, Mental, or Magical DCs. The info modal lets you choose the eligible proficient attribute used to scale it.",
        "rules": [
          "DC = 5 + PB + chosen attribute including active modifiers + direct DC modifiers."
        ],
        "example": "With PB 3 and Physical chosen at +2, DC is 10 before other modifiers. An active +3 Physical primitive makes Physical +5 and DC 13. A direct +1 DC makes it 14."
      },
      {
        "title": "Three saving throws",
        "body": "When an incoming capability calls for a save, the recipient rolls d20 plus the appropriate displayed save bonus against the capability user’s DC. A Physical source normally calls for a Physical save, a Psychic/Mental source for a Mental save, and a Magical source for a Magical save. Meet or beat the DC to resist according to the agreed rule. Decide beforehand whether success avoids the effect, reduces it or produces another outcome. Saving throws and DC are separate numbers.",
        "rules": [
          "Save = d20 + relevant attribute + PB if proficient + applicable save modifiers."
        ],
        "example": "An effect can ask for a Mental save against its creator’s single DC. That does not create a separate Mental DC."
      },
      {
        "title": "Rounding and displayed totals",
        "rules": [
          "Round results up whenever rounding is needed."
        ],
        "body": "Use the current totals shown in the sheet. Its info modals identify contributing primitives, active conditions, proficiency, and any constraints. Do not add the same displayed bonus again to your roll."
      }
    ],
    "sources": [
      {
        "title": "Practice System",
        "url": "https://app.notion.com/p/38eed8479ccd803b9544f1d0ce3d97cf"
      }
    ]
  },
  {
    "id": "combat",
    "title": "Combat rhythm",
    "summary": "Council → Fast → Measured → Heavy, with reactions as the scene changes.",
    "keywords": "combat rhythm initiative round council complexity fast measured heavy main intent movement",
    "blocks": [
      {
        "title": "1. Council: declare together",
        "body": "Council is the whole party creating a plan for the same situation. Each player describes one Main Intent. Listen to the other players, coordinate roles and movement, and check how your actions support each other. The DM describes the enemies’ round and what your characters can perceive of their plan. Agree the scope and stakes before the shared scenario unfolds."
      },
      {
        "title": "2. Assign a complexity track",
        "rules": [
          "Fast: Complexity 0–1. Immediate or simple actions resolve first.",
          "Measured: Complexity 2–3. Deliberate, connected actions resolve next.",
          "Heavy: Complexity 4+. Extended or complex actions resolve last."
        ],
        "body": "The GM assigns the track from the attempted action. Complexity measures what must happen before the action manifests; it is not a damage or power ranking."
      },
      {
        "title": "3. Resolve the changing scene",
        "body": "Resolve Fast, then Measured, then Heavy. Allies in the same track choose an order that supports their plan; the GM orders adversaries. There is no default initiative roll. Resolve a clash or contest only when opposing intents actually collide."
      },
      {
        "title": "4. Carry consequences into the next round",
        "body": "Finish triggered reactions, apply outcomes and ongoing effects, and review duration and maintenance. Begin a new Council Phase. Reaction Slots reset, and everyone declares intent for the changed situation."
      },
      {
        "title": "One complete party round",
        "body": "The party needs to cross a collapsing bridge while a guard prepares to ring an alarm. Their goal is not just to deal damage: keep the group together, prevent the alarm and get everyone across.",
        "details": [
          {
            "title": "Council: build the plan together",
            "body": "Mira says, “I will pin the guard’s alarm arm.” Sol says, “I will form a supported path across the gap.” Neri says, “I will get our injured friend across once the path is ready.” They confirm who moves where. The DM says the guard is reaching for the bell while another enemy tries to break the support."
          },
          {
            "title": "Before resolution: confirm timing and stakes",
            "body": "The DM places the simple rush in Fast and the constructed path in Measured. Neri’s rescue depends on that path: the table agrees how it fits in the round. They check the path-maker’s access and agree how long the path lasts, whether it needs upkeep, what the effort costs, and what failure would mean."
          },
          {
            "title": "Fast: opposing intents meet",
            "body": "Mira and the guard directly conflict over the bell. Timing matters, so they resolve a Reaction Clash. Suppose the guard wins and rings it. The alarm is now part of the scene; Mira can still pin him if that remains possible. Meanwhile the other enemy damages a support."
          },
          {
            "title": "Measured and Heavy: use the changed situation",
            "body": "Sol completes a smaller maintained path because the support is damaged. Neri crosses with their friend in the agreed order. If someone slips, a player can spend an available Reaction Slot to catch them when their position and permissions allow it. An elaborate third action would resolve in Heavy, after these changes."
          },
          {
            "title": "End of round: record the outcome",
            "body": "The party is across, but the alarm has sounded. Pay agreed costs, note the temporary path and its upkeep, apply damage and consequences, and review durations. Begin a new Council with the new problem: pursuers will be arriving. This is one shared round, not a sequence of isolated scenes."
          }
        ]
      }
    ],
    "sources": [
      {
        "title": "The Combat Rhythm",
        "url": "https://app.notion.com/p/392ed8479ccd80f5b55ffe9863ab815d"
      }
    ]
  },
  {
    "id": "reactions",
    "title": "Clashes, contests & reactions",
    "summary": "Resolve timing, struggle, or a sudden response with the right rule.",
    "keywords": "reaction clash active contest pivot interruption timing initiative reaction slot",
    "blocks": [
      {
        "title": "Reaction Clash: who acts first?",
        "body": "Use a clash when opposing intents collide within the same track and timing determines the outcome. The higher roll acts first. On a tie, the GM resolves simultaneously or follows the stronger fictional position.",
        "rules": [
          "Reaction Clash = d20 + relevant attribute + PB if trained."
        ],
        "example": "You reach for the alarm lever while the guard tries to pull it. Timing decides which intent arrives first."
      },
      {
        "title": "Active Contest: whose effort wins?",
        "body": "Use a contest for a direct physical, mental or magical struggle. It can use practices as well as broad attributes: the DM and players choose the relevant approach for each side. Use the displayed practice bonus if a practice applies; it already includes its attribute, training and modifiers. The higher result wins the immediate struggle.",
        "rules": [
          "Attribute contest: d20 + relevant attribute + applicable proficiency and modifiers.",
          "Practice contest: d20 + the relevant displayed practice bonus. Do not add its attribute or PB again."
        ],
        "example": "Holding a door shut may use Physical or Prowess. Sneaking past a watchful guard might compare your Finesse with their Awareness. Different approaches can oppose one another when the fiction supports them."
      },
      {
        "title": "Pivot when the situation changes",
        "body": "Losing a clash does not automatically erase your Main Intent. If the original action no longer works, adjust it before resolution: redirect, reduce the scale, accept another cost, or make a sensible defensive response."
      },
      {
        "title": "One independent Reaction Slot",
        "rules": [
          "Baseline: one Reaction Slot per combat round, reset at Council.",
          "Baseline reaction: immediate, Complexity 0–1, and self/touch or a single target."
        ],
        "body": "A reaction needs a clear event and a response you can perceive and perform. It can occur before or after your Main Intent. Pause the triggering event, resolve the response, and continue. A reaction does not automatically cancel the trigger.",
        "example": "When a nearby ally falls, use your reaction to catch them if your position allows it. A larger rescue needs a specific permission or an explicit ruling and consequences."
      }
    ],
    "sources": [
      {
        "title": "The Combat Rhythm",
        "url": "https://app.notion.com/p/392ed8479ccd80f5b55ffe9863ab815d"
      }
    ]
  },
  {
    "id": "strain",
    "title": "Strain, Cost & scaling",
    "summary": "Start with the weight of the action. Use optional calculations to support the conversation.",
    "keywords": "strain cv cost complexity scaling quickening vitality execution resource heuristic time",
    "blocks": [
      {
        "title": "Three questions make an action understandable",
        "body": "Scale asks how much: one person or a crowd, a spark or a room. Impact asks how strongly it changes things: distract, injure, restrain or transform. Complexity asks how its parts depend on each other: a direct blast, a selective blast, or a chain that creates a shelter and moves allies into it. The scene adds resistance and time pressure."
      },
      {
        "title": "The DM judges Strain from the actual attempt",
        "body": "Strain is a 0–6 guide to how hard the action pushes the character and the world. Begin with the action’s practical weight, available access, opposition, environment and urgency. Numerical scaling can help compare familiar uses; simply adding more numbers cannot describe every difference between two actions.",
        "example": "A blast that harms everyone in a clearing and a blast that heals allies while harming enemies are different constructions. Selective behavior and the extra outcome may need more access and complexity even when the dice count is identical.",
        "details": [
          {
            "title": "The seven Strain grades",
            "body": "These are evaluation guides, not automatic bills or fixed success chances.",
            "rules": [
              "0 · Effortless: little pressure in the current situation.",
              "1 · Light effort: a manageable demand.",
              "2 · Noticeable strain: effort or a meaningful trade-off.",
              "3 · Heavy burden: substantial pressure.",
              "4 · Dangerous instability: serious consequences deserve discussion.",
              "5 · Critical risk: a very demanding attempt with severe stakes.",
              "6 · Catastrophic consequence: extreme pressure; make the stakes explicit before committing."
            ]
          }
        ]
      },
      {
        "title": "Cost gives that pressure a consequence",
        "body": "Agree what doing the action costs before you commit. Cost may be Vitality, a resource, a penalty to a roll or number, exposure, environmental change, a narrative complication, or a combination. It may also be negligible. A Strain grade does not mandate a fixed Vitality charge. Agree when the cost applies and what happens on failure; interruption has no universal refund.",
        "example": "Opening a wet lock with heat might leave a scorched tool or exhaust you. Igniting an entire roof could spread the fire into homes. Reducing the scope or allowing more time can change those stakes."
      },
      {
        "title": "Owned access and scaling answer different questions",
        "body": "A range primitive and dice-type primitive establish access. Owning d10 and Very Far range lets you propose a use that needs those permissions; it does not make a 4d10 Very Far blast cost the same effort as a 1d4 Touch use. Dice count, area, targets, duration and other table-selected scaling do not each require a new primitive by default, but still increase the composed action’s CV and may increase Strain. Extra behaviors or effects can require additional primitives."
      },
      {
        "title": "Choose the expression that fits the moment",
        "body": "Say the output, reach, targets, area, duration and timing you want now. The DM checks access and evaluates the whole intent. You can start from a saved capability and scale it, combine owned pieces differently, or acquire a missing primitive using spare BU when agreed. Rushing work, linking several dependent outcomes or making a broad effect selectively spare allies can add pressure.",
        "example": "“I have Fire access, the relevant verb, d10 and Very Far. I want four dice of output against that cluster.” The table agrees the cluster size and resolution. “I also want it to heal allies” is another behavior to check, not something granted by raising the dice count."
      },
      {
        "title": "Tier guidelines help compare designs",
        "body": "Primitive tiers are broad authoring guides. Compare what a piece enables, how broadly it applies, its conditions, and its influence on play. A more limited or conditional fork can be priced differently. Authors ultimately choose their prices; a tier or BU total does not guarantee that an action will be equally easy in every scene.",
        "details": [
          {
            "title": "Minor · roughly 1–2 BU",
            "body": "Small changes, light structural pieces and limited utility."
          },
          {
            "title": "Standard · roughly 3–5 BU",
            "body": "Common building blocks and useful, bounded changes."
          },
          {
            "title": "Major · roughly 6–10 BU",
            "body": "Build-defining ingredients, stronger tactical changes or more involved interactions."
          },
          {
            "title": "Core · roughly 11–20 BU",
            "body": "Fundamental shifts to capability or character behavior, substantial permissions and constraints."
          },
          {
            "title": "Narrative · roughly 21–64+ BU",
            "body": "Very broad or profound changes whose practical significance needs close table judgment. These ranges are guidelines; they are not universal price rules or level caps."
          }
        ]
      },
      {
        "title": "Optional: CV and the scaling calculation",
        "body": "CV (Complexity Value) is a mathematical reference for the total weight of a composed use. You can play by describing the action and agreeing its pressure; the following comparison helps tables that want numerical scaffolding.",
        "details": [
          {
            "title": "Total CV is more than the scaling increase",
            "body": "Let B be the evaluated cost of the composition at its lowest table-selected values. Let A be the evaluated cost at the values chosen for this use, including its primitives, nested effects and scaling choices. The difference A − B is the scaling increase, ΔCV. Total CV is B + ΔCV = A. CV is not added to an attack or save, and it is not BU spent again to cast.",
            "rules": [
              "ΔCV = evaluated use at chosen values − evaluated use at minimum values.",
              "Total CV = minimum composition value + ΔCV."
            ]
          },
          {
            "title": "An illustrative comparison",
            "body": "Suppose your table evaluates a minimum composition at 12 and the selected larger use at 30. Its scaling increase is 18; its total CV is 30. These numbers illustrate the calculation, not a universal price for a spell. A chosen extra effect or primitive belongs in the evaluated composition too; owning it removes a new purchase charge, not its relevance to the action’s weight."
          },
          {
            "title": "Why maximum minus minimum is still only a guide",
            "body": "Comparing all maximum numerical settings with all minimum settings estimates the span of numerical scaling for that design. It does not capture every environmental challenge, selective rule, dependency or narrative consequence. Evaluate the actual action, including added effects and primitives. The DM uses that comparison alongside the situation to judge Strain and Cost."
          }
        ]
      }
    ],
    "sources": [
      {
        "title": "Evaluation Layer",
        "url": "https://app.notion.com/p/37eed8479ccd81a4bd1ae21e1a0e1354"
      },
      {
        "title": "Player Loop",
        "url": "https://app.notion.com/p/37fed8479ccd811b9b1cc3a97723dc6e"
      }
    ]
  },
  {
    "id": "upkeep",
    "title": "Duration, upkeep & interruption",
    "summary": "When it resolves, how long it lasts, and what sustains it are separate.",
    "keywords": "upkeep maintain concentration interruption casting duration payment damage pressure sustained",
    "blocks": [
      {
        "title": "Three separate properties",
        "body": "Track determines when the capability resolves. Duration determines how long its resulting effect lasts. Upkeep determines whether you must actively sustain it. A fixed duration does not automatically require upkeep.",
        "example": "A flame can flash and end; remain for two rounds without maintenance; or last while you sustain it. Those are different constructions."
      },
      {
        "title": "Maintenance can make the attempt easier",
        "body": "Sustaining a smaller effect can be less demanding upfront than forcing a huge result in one instant. You trade ongoing attention, payments and vulnerability to interruption for a different expression of the action. Upkeep is therefore part of evaluating the design, not always an extra charge on an otherwise identical blast.",
        "example": "A sudden large fireburst, a maintained fire field, and a smaller maintained field with lower output can have different initial costs and upkeep. Agree the whole construction; there is no universal discount."
      },
      {
        "title": "Pay to keep it active",
        "body": "Upkeep exists when the capability specifies maintenance. The GM sets the actual upkeep cost for the current situation. Pay at the start of your turn to continue; if you do not pay, the maintained effect ends. Keep this payment point explicit within your table’s shared round.",
        "example": "Maintaining invisibility among distracted commoners may be easier than sustaining it in a court watched by trained mages."
      },
      {
        "title": "One capability, one upkeep track",
        "body": "Multiple effects inside one capability remain one execution with one upkeep track and one Strain evaluation. You can maintain several capabilities; their costs accumulate. There is no default single-concentration limit."
      },
      {
        "title": "Damage creates maintenance pressure",
        "rules": [
          "When upkeep is paid in Vitality, total damage during the turn reaching or exceeding that upkeep cost calls for immediately re-paying it to maintain the capability."
        ],
        "body": "This numerical comparison applies to upkeep measured in Vitality. Other upkeep can be a resource, a condition, a sustained task or a narrative consequence; damage is not automatically comparable to any of those. Agree how maintenance can be disrupted and what continuing would require when you establish the capability. A hit may threaten maintenance, but does not universally end it or demand a D&D-style concentration save. If the agreed payment or requirement cannot be met, the maintained effect ends.",
        "example": "A field costs 4 Vitality in upkeep. Taking 2 damage and then 3 in the same turn reaches the threshold: re-pay 4 Vitality or let it end.",
        "details": [
          {
            "title": "When upkeep is not Vitality",
            "body": "Suppose a ward is maintained by singing continuously. A hit alone need not stop it; being silenced may break the actual requirement. If an illusion is sustained by burning incense, losing the incense can end it, while a wounded caster may continue. If upkeep is accumulating fatigue or attracting attention, agree whether disruption adds another consequence, requires a contest to continue, or ends the working. Establish these terms together; there is no universal conversion from damage to fatigue, incense or narrative cost."
          }
        ]
      },
      {
        "title": "Interrupt before the action resolves",
        "body": "First describe how you interfere and establish a real opportunity: reach the caster, disrupt the working, break an essential support, or use an appropriate countering capability. If it is a reaction, confirm your Reaction Slot and its scope. The DM checks timing, access and whether your action actually threatens the unfinished work. Resolve any attack, save, clash or contest required. Then apply the agreed failure, partial result or continued execution.",
        "details": [
          {
            "title": "Successful interference",
            "body": "An enemy is preparing a complex gate that needs an intact chalk circle. Before it completes, you reach and scatter the chalk. If the circle is essential and your interference succeeds, the gate can fail or open only partially. The DM determines whether none, part or all of its cost was already incurred."
          },
          {
            "title": "An attempt that does not stop the action",
            "body": "You shoot at the gate-maker, but miss; the working continues. Or you hit, but the gate did not depend on stillness and no agreed disruption rule was met. Damage alone is not a universal cancellation button. If upkeep applies, use the damage-pressure rule as well."
          },
          {
            "title": "A completed action has no remaining casting window",
            "body": "Once an instant flash has resolved, you cannot retroactively interrupt its execution. You might avoid its effects with a valid response, or disrupt a resulting ongoing effect using the relevant permission and resolution."
          }
        ]
      },
      {
        "title": "Conditions and maintenance",
        "body": "Check the effect’s interruption rules and agree with the GM how an imposed consequence affects your ability to maintain or finish the capability. Discuss this when applying the condition so everyone understands what remains possible."
      }
    ],
    "sources": [
      {
        "title": "Capability Upkeep & Interruption",
        "url": "https://app.notion.com/p/37fed8479ccd81aa9467d9779c45f40a"
      },
      {
        "title": "Player Loop clarifications",
        "url": "https://app.notion.com/p/37fed8479ccd811b9b1cc3a97723dc6e"
      }
    ]
  },
  {
    "id": "damage",
    "title": "Damage, resistance & vulnerability",
    "summary": "Identify source and domain, apply the matching defenses, then lose Vitality.",
    "keywords": "damage healing resistance vulnerability immunity source physical psychic magical domain fire rounding",
    "blocks": [
      {
        "title": "Source is how; domain is what",
        "body": "Physical, Magical, and Psychic describe execution origin. Fire, Ice, Gravity, Emotion, and other domains describe identity. Physical fire and magical fire share a domain but have different sources. Read which source or domain each defense covers."
      },
      {
        "title": "Resolve each damage instance",
        "rules": [
          "Resistance: half the damage, rounded up.",
          "Vulnerability: double the damage.",
          "Immunity: zero damage within its stated scope.",
          "Multiple resistances do not stack by default; use the strongest applicable single resistance.",
          "Applicable resistance and vulnerability on the same instance cancel: take full damage."
        ],
        "example": "9 magical fire damage becomes 5 with matching resistance, 18 with matching vulnerability, or 9 if both resistance and vulnerability apply. Immunity to that damage makes it 0. Damage immunity does not automatically grant immunity to every associated condition: check the permission’s scope."
      },
      {
        "title": "Mixed output needs an explicit breakdown",
        "body": "Read whether multiple domains split one output or produce separate instances. For mixed execution sources, separate the output by source before applying defenses. The capability or the GM defines the intended breakdown.",
        "example": "A hybrid blast deals 6 Physical Fire and 8 Magical Fire. Magical resistance reduces only the Magical portion to 4: total loss is 10. Fire resistance covering both portions would instead apply to both."
      },
      {
        "title": "Apply the final result",
        "body": "All damage is Vitality loss. Healing restores Vitality within the character’s current maximum. Resolve output and typed defenses at the table, then use the sheet’s manual Vitality controls to apply the final amount. Entering raw damage there does not automatically apply typed resistance or vulnerability."
      }
    ],
    "sources": [
      {
        "title": "Damage & Resistance",
        "url": "https://app.notion.com/p/380ed8479ccd81f69dcbf3888f5e384b"
      }
    ]
  },
  {
    "id": "vitality",
    "title": "Vitality, collapse & consequences",
    "summary": "Your health and exertion share one resource; consequences record the fiction.",
    "keywords": "vitality health hp healing collapse death unconscious stabilize cost consequence condition poisoned burning slowed",
    "blocks": [
      {
        "title": "One resource for survival and exertion",
        "rules": [
          "Base maximum Vitality = (10 + PB) × level; apply active maximum-Vitality modifiers."
        ],
        "body": "Vitality covers health, stamina, and exertion. There is no universal separate mana or spell-slot pool. Use the sheet’s derived maximum and current value; active primitives can change the maximum."
      },
      {
        "title": "Conditions get meaning from context",
        "body": "A name such as Poisoned, Burning, or Slowed does not impose one universal numerical package. Describe what caused it, what it does, when it applies, and how it ends. Record the agreed effect or consequence on the sheet. A capability or effect can suggest what a condition means in its verbose description, or attach mechanical rules for that specific expression. Agree whether a particular condition prevents casting, movement or upkeep; its name alone does not answer that.",
        "example": "Smoke inhalation, poisoned food, and a psychedelic ordeal can create very different consequences. “Slowed” need not always mean −10 ft movement."
      },
      {
        "title": "At 0 Vitality",
        "body": "The character collapses, unconscious and incapacitated. The GM sets a contextual rescue clock: roughly a minute is guidance, not a guaranteed ten safe rounds. Severe wounds and hostile environments can shorten it. Allies can attempt Fieldcraft stabilization or a creative use of their available primitives."
      },
      {
        "title": "Massive damage",
        "rules": [
          "A single execution dealing at least twice maximum Vitality, or taking current Vitality to −maximum Vitality, can cause immediate death under the massive-damage rule."
        ],
        "body": "Discuss lethal stakes before resolution. The rescue clock applies to collapse, not to a character whose framework is destroyed outright."
      },
      {
        "title": "Record what happened",
        "body": "Consequences make injuries, restrictions, and narrative costs visible. Their description and any attached rules determine how they affect the character. Review them when the situation changes instead of assuming a label explains every interaction."
      }
    ],
    "sources": [
      {
        "title": "Vitality System",
        "url": "https://app.notion.com/p/37eed8479ccd81d693dbf6ca9b4ac4c4"
      },
      {
        "title": "Tactical Subsystems & Collapse",
        "url": "https://app.notion.com/p/390ed8479ccd80118106cd4b8f28a9bf"
      }
    ]
  },
  {
    "id": "equipment",
    "title": "Items, Load, slots & cover",
    "summary": "Carry capacity and equipped slots measure different things.",
    "keywords": "equipment item load carry capacity slot pouch two handed size movement cover vector manifestation",
    "blocks": [
      {
        "title": "Carried Load",
        "rules": [
          "Carry capacity = size base + 5 × Physical modifier + applicable capacity bonuses."
        ],
        "body": "Size bases are Tiny 10, Small 20, Medium 40, Large 80, Huge 160, and Gargantuan 320. Carried items contribute Load even when unequipped. Exceeding capacity makes you encumbered; the GM determines the relevant penalties and complications."
      },
      {
        "title": "Equipped slots",
        "rules": [
          "Base equipment capacity: 6 universal slots.",
          "A two-handed item uses at least 2 slots; its authored slot cost can be higher."
        ],
        "body": "Equipped slots describe what you have in use. Load describes what you carry. Equipping something does not remove its Load, and storing it does not necessarily remove it from your inventory."
      },
      {
        "title": "Tiny objects and pouches",
        "rules": [
          "One pouch holds up to 1,000 tiny items and contributes 1 Load."
        ],
        "body": "A mundane backpack organizes items; it does not automatically change capacity. Special storage must state its rule."
      },
      {
        "title": "Cover depends on how the action reaches its target",
        "body": "A projected vector travels through space: an arrow, beam or thrown blast. Obstructions can deflect or stop it. A direct manifestation appears at the target and ignores intervening cover penalties, but still needs line of sight or a legitimate sensory lock. Consider the actual path and what the obstruction protects.",
        "rules": [
          "Projected vectors: minor obstruction −2 accuracy; standard half cover −4; total cover blocks the trajectory."
        ],
        "example": "A visible head above a wall can be reached by a direct psychic manifestation without the projected half-cover penalty. The same wall obstructs a firebolt travelling through space. Neither permission lets you automatically target someone you cannot locate.",
        "details": [
          {
            "title": "Minor obstruction · −2",
            "body": "A thin fence, scattered branches or a narrow post interferes with the shot but leaves most of the target exposed. Decide from the actual angle rather than the object’s name."
          },
          {
            "title": "Half cover · −4",
            "body": "A waist-high stone wall or substantial crate hides roughly half the target from this trajectory. It helps against a bolt coming from that direction; it may not protect against an attack from above."
          },
          {
            "title": "Total cover · trajectory blocked",
            "body": "An intact wall completely separates the target from the arrow or beam. That projected attack cannot pass through without a relevant permission. A fully hidden target also needs a legitimate way to locate it before a direct manifestation can affect it."
          }
        ]
      }
    ],
    "sources": [
      {
        "title": "Encumbrance System",
        "url": "https://app.notion.com/p/380ed8479ccd8114afb0c77a0dd0b3ed"
      },
      {
        "title": "Cover & Manifestation",
        "url": "https://app.notion.com/p/390ed8479ccd80118106cd4b8f28a9bf"
      }
    ]
  },
  {
    "id": "creating",
    "title": "Create, edit & fork",
    "summary": "Turn your own concept into reusable rules, adapt a Library seed, and keep ownership and versions clear.",
    "keywords": "atelier create author edit fork publish private library ownership version primitive capability effect heritage",
    "blocks": [
      {
        "title": "Start with the idea you want to play",
        "body": "Describe the result in plain language before looking for a Library entry: “I want to stitch memories into maps,” for example. Discuss what that means with the DM. Break it into subjects you can affect, actions you can perform and any special rules it needs. You can author a primitive, effect, capability, heritage or item in the Atelier. The community Library provides inspiration; your concept does not have to match an existing entry."
      },
      {
        "title": "Create a reusable building block",
        "body": "In the Atelier, choose the kind of piece you are building and give it a clear name and description. A primitive grants one reusable permission or rule. Describe its intended scope, limits and price; add a mechanical rule when a tracked number or behavior should change. The description explains what happens in the fiction. A mechanical rule helps the sheet calculate it. Neither replaces the table’s judgment about an actual action.",
        "example": "“Cartographic Memory” could permit recording a witnessed place as a remembered map. Explain what can be recalled and what remains uncertain. Agree its BU price and limits before purchasing it for play."
      },
      {
        "title": "Compose effects and capabilities",
        "body": "An effect groups related primitives; a capability compiles pieces into a ready idea for play. Select the relevant pieces, describe targeting and resolution, and state duration, upkeep and consequences where needed. Preview the composition to check that it says what you mean. Saved capabilities are shortcuts: owned primitives can still be combined into new actions at the table."
      },
      {
        "title": "Fork something you want to adapt",
        "body": "Fork makes your own copy of a Library piece or public character. Open its preview or sheet, choose Fork, then work on your copy. A public character opens read-only; fork it to change Vitality, consequences or its build. Your edits to the copy do not rewrite the original author’s work. Review inherited rules and costs before using the copy."
      },
      {
        "title": "Edit, save and review",
        "body": "Open your own creation in the Atelier or open edit mode on a character you own or have edit permission for. Change the description or composition, inspect the preview and budget, then save. Reading a Library preview does not give edit permission. Fork a piece owned by somebody else when you want your own version. A character can keep a pinned older version; review an offered update before adopting it."
      },
      {
        "title": "Choose who can see the work",
        "body": "Keep a draft private while shaping it. Use the available sharing or publishing controls when you want others to read or reuse it. Publishing is a separate choice from writing a useful rule for your own table. Check the current visibility before you finish."
      },
      {
        "title": "Bring the new rule into play",
        "body": "Agree its price and permissions with the DM, then acquire the primitive using available BU. You can invent and purchase a piece during a session, including combat when it makes sense for the scene. Buying it grants access; the particular action still needs an agreed resolution and cost. Keep a note of the ruling so the next use is easier."
      }
    ]
  },
  {
    "id": "sheet",
    "title": "Use the character sheet",
    "summary": "Read live totals, inspect the rules, and record the table’s outcomes.",
    "keywords": "app sheet drawer modal active inactive conditional trigger manual automatic override edit atelier library preview save version",
    "blocks": [
      {
        "title": "Inspect a number",
        "body": "Open the bottom drawer and the info modal for a stat, attack bonus, DC, save, or practice. Check the base, contributions, active conditions, and chosen scaling attribute. These details explain the displayed total."
      },
      {
        "title": "Active and conditional rules",
        "body": "An inactive rule does not contribute. A condition belongs to the primitive itself: tracked numerical conditions can evaluate automatically, while contextual conditions need a manual state. Overrides let you reflect the table’s ruling.",
        "example": "“Self Vitality below 50%” can read the tracked Vitality. “When tracking enemies” needs the appropriate manual state; it is still an authored condition, not an extra condition invented each time you use the primitive."
      },
      {
        "title": "Recipients matter",
        "body": "A rule targeting Self affects your sheet when active and triggered. A rule targeting someone else belongs in that recipient’s resolution. Your own sheet should not gain every bonus or lose every damage amount your capability can produce."
      },
      {
        "title": "Apply table outcomes",
        "body": "Damage, healing, contextual conditions, upkeep payments, and consequences may need manual application. Resolve them with the GM, then adjust current Vitality or record the effect. A saved output expression describes what to resolve; saving it does not automatically roll or hit a target."
      },
      {
        "title": "Develop the build",
        "body": "Use the Library to inspect compositions and the Atelier/edit workflow to adapt them. Review the purchase total and change summary before saving. Existing owned primitives can be reused; item availability and version pins remain meaningful."
      },
      {
        "title": "Find help in context or here",
        "body": "The existing local help modals remain available next to the field or number they explain. This guide gathers the general rules into one place. Open Rules from the sheet’s FAB to keep the sheet underneath, or use the standalone Rules page."
      }
    ]
  }
];

function blockSearchText(block: GuideBlock): string[] {
  return [block.title, block.body ?? '', ...(block.rules ?? []), block.example ?? '', ...(block.details ?? []).flatMap(blockSearchText)];
}

export function searchGuide(query: string): GuideTopic[] {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return PLAY_GUIDE.filter(topic => {
    const haystack = [topic.title, topic.summary, topic.keywords, ...topic.blocks.flatMap(blockSearchText)].join(' ').toLowerCase();
    return words.every(word => haystack.includes(word));
  });
}
