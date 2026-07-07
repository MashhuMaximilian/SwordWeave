# SwordWeave Live Schema (Postgres)

> Dumped: 2026-07-07T21:04:59.659Z
> Database: Neon Postgres (eu-central-1)

## Tables (46)

| Table | Rows |
|---|---|
| `build_capabilities` | 0 |
| `builds` | 0 |
| `capabilities` | 28 |
| `capability_effects` | 1 |
| `capability_primitives` | 73 |
| `capability_versions` | 0 |
| `character_capabilities` | 9 |
| `character_items` | 3 |
| `character_primitives` | 0 |
| `character_versions` | 0 |
| `characters` | 3 |
| `condition_primitives` | 0 |
| `conditions` | 0 |
| `effect_conditions` | 0 |
| `effect_effects` | 1 |
| `effect_primitives` | 24 |
| `effect_versions` | 0 |
| `effects` | 7 |
| `entities` | 0 |
| `entity_capabilities` | 0 |
| `entity_inventory` | 0 |
| `entity_primitives` | 0 |
| `flag_aggregates` | 0 |
| `flags` | 0 |
| `follows` | 0 |
| `fork_aggregates` | 10 |
| `forks` | 17 |
| `item_capabilities` | 0 |
| `item_effects` | 0 |
| `item_primitives` | 5 |
| `item_versions` | 0 |
| `items` | 5 |
| `primitive_adoptions` | 0 |
| `primitive_versions` | 1 |
| `primitives` | 182 |
| `publications` | 3 |
| `reaction_aggregates` | 8 |
| `reactions` | 6 |
| `reserved_usernames` | 46 |
| `template_capabilities` | 1 |
| `template_primitives` | 23 |
| `template_versions` | 0 |
| `templates` | 16 |
| `user_stats` | 4 |
| `username_history` | 0 |
| `users` | 4 |

## `build_capabilities`

| Column | Type | Null | Default |
|---|---|---|---|
| `build_id` | uuid | NO | — |
| `capability_id` | uuid | NO | — |
| `acquired_at_level` | integer | NO | 1 |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

**Indexes:**

- `build_capabilities_build_id_idx` — CREATE INDEX build_capabilities_build_id_idx ON public.build_capabilities USING btree (build_id)
- `build_capabilities_capability_id_idx` — CREATE INDEX build_capabilities_capability_id_idx ON public.build_capabilities USING btree (capability_id)
- `build_capabilities_pk` — CREATE UNIQUE INDEX build_capabilities_pk ON public.build_capabilities USING btree (build_id, capability_id)

**Foreign keys:**

- `build_id` → `builds.id` (ON DELETE CASCADE)
- `capability_id` → `capabilities.id` (ON DELETE RESTRICT)

**Primary keys:**

- `build_capabilities_pk`: PRIMARY KEY (build_id, capability_id)

## `builds`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | NO | gen_random_uuid() |
| `user_id` | text | YES | — |
| `name` | text | NO | — |
| `description` | text | YES | — |
| `level` | integer | NO | 1 |
| `starting_bu` | integer | NO | 25 |
| `is_archetype_template` | boolean | NO | false |
| `race_name` | text | YES | — |
| `race_description` | text | YES | — |
| `background_name` | text | YES | — |
| `background_description` | text | YES | — |
| `archetype_name` | text | YES | — |
| `attr_physical` | integer | YES | — |
| `attr_mental` | integer | YES | — |
| `attr_magical` | integer | YES | — |
| `attr_proficient` | USER-DEFINED | YES | — |
| `practice_slices` | jsonb | YES | — |
| `portrait_url` | text | YES | — |
| `race_id` | uuid | YES | — |
| `background_id` | uuid | YES | — |
| `is_public` | boolean | NO | false |
| `source_origin` | text | YES | — |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

**Indexes:**

- `builds_is_archetype_idx` — CREATE INDEX builds_is_archetype_idx ON public.builds USING btree (is_archetype_template)
- `builds_is_public_idx` — CREATE INDEX builds_is_public_idx ON public.builds USING btree (is_public)
- `builds_pkey` — CREATE UNIQUE INDEX builds_pkey ON public.builds USING btree (id)
- `builds_user_id_idx` — CREATE INDEX builds_user_id_idx ON public.builds USING btree (user_id)

**Foreign keys:**

- `background_id` → `templates.id` (ON DELETE SET NULL)
- `race_id` → `templates.id` (ON DELETE SET NULL)

**Primary keys:**

- `builds_pkey`: PRIMARY KEY (id)

## `capabilities`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | NO | gen_random_uuid() |
| `name` | text | NO | — |
| `type` | USER-DEFINED | NO | — |
| `source_type` | USER-DEFINED | NO | — |
| `verbose_description` | text | NO | ''::text |
| `is_public` | boolean | NO | false |
| `source_origin` | text | YES | — |
| `tags` | ARRAY | NO | ARRAY[]::text[] |
| `metadata` | jsonb | NO | '{}'::jsonb |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |
| `user_id` | text | YES | — |

**Indexes:**

- `capabilities_is_public_idx` — CREATE INDEX capabilities_is_public_idx ON public.capabilities USING btree (is_public)
- `capabilities_name_source_origin_unique_idx` — CREATE UNIQUE INDEX capabilities_name_source_origin_unique_idx ON public.capabilities USING btree (name, source_origin)
- `capabilities_pkey` — CREATE UNIQUE INDEX capabilities_pkey ON public.capabilities USING btree (id)
- `capabilities_source_type_idx` — CREATE INDEX capabilities_source_type_idx ON public.capabilities USING btree (source_type)
- `capabilities_tags_idx` — CREATE INDEX capabilities_tags_idx ON public.capabilities USING gin (tags)
- `capabilities_type_idx` — CREATE INDEX capabilities_type_idx ON public.capabilities USING btree (type)
- `capabilities_user_id_idx` — CREATE INDEX capabilities_user_id_idx ON public.capabilities USING btree (user_id)

**Primary keys:**

- `capabilities_pkey`: PRIMARY KEY (id)

## `capability_effects`

| Column | Type | Null | Default |
|---|---|---|---|
| `capability_id` | uuid | NO | — |
| `effect_id` | uuid | NO | — |
| `sort_order` | integer | NO | 0 |
| `slot_label` | text | YES | — |
| `notes` | text | YES | — |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

**Indexes:**

- `capability_effects_capability_id_idx` — CREATE INDEX capability_effects_capability_id_idx ON public.capability_effects USING btree (capability_id)
- `capability_effects_effect_id_idx` — CREATE INDEX capability_effects_effect_id_idx ON public.capability_effects USING btree (effect_id)
- `capability_effects_pk` — CREATE UNIQUE INDEX capability_effects_pk ON public.capability_effects USING btree (capability_id, effect_id)

**Foreign keys:**

- `capability_id` → `capabilities.id` (ON DELETE CASCADE)
- `effect_id` → `effects.id` (ON DELETE CASCADE)

**Primary keys:**

- `capability_effects_pk`: PRIMARY KEY (capability_id, effect_id)

## `capability_primitives`

| Column | Type | Null | Default |
|---|---|---|---|
| `capability_id` | uuid | NO | — |
| `primitive_id` | integer | NO | — |
| `role` | USER-DEFINED | NO | — |
| `quantity` | integer | NO | 1 |
| `sort_order` | integer | NO | 0 |
| `slot_label` | text | YES | — |
| `notes` | text | YES | — |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

**Indexes:**

- `capability_primitives_capability_id_idx` — CREATE INDEX capability_primitives_capability_id_idx ON public.capability_primitives USING btree (capability_id)
- `capability_primitives_pk` — CREATE UNIQUE INDEX capability_primitives_pk ON public.capability_primitives USING btree (capability_id, primitive_id, role)
- `capability_primitives_primitive_id_idx` — CREATE INDEX capability_primitives_primitive_id_idx ON public.capability_primitives USING btree (primitive_id)
- `capability_primitives_role_idx` — CREATE INDEX capability_primitives_role_idx ON public.capability_primitives USING btree (role)

**Foreign keys:**

- `capability_id` → `capabilities.id` (ON DELETE CASCADE)
- `primitive_id` → `primitives.id` (ON DELETE CASCADE)

**Primary keys:**

- `capability_primitives_pk`: PRIMARY KEY (capability_id, primitive_id, role)

## `capability_versions`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | NO | gen_random_uuid() |
| `capability_id` | uuid | NO | — |
| `version_number` | integer | NO | — |
| `is_latest` | boolean | NO | false |
| `delta_kind` | USER-DEFINED | NO | — |
| `snapshot` | jsonb | NO | — |
| `published_by_user_id` | uuid | YES | — |
| `published_at` | timestamp with time zone | NO | now() |
| `superseded_at` | timestamp with time zone | YES | — |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

**Indexes:**

- `capability_versions_pkey` — CREATE UNIQUE INDEX capability_versions_pkey ON public.capability_versions USING btree (id)

**Primary keys:**

- `capability_versions_pkey`: PRIMARY KEY (id)

## `character_capabilities`

| Column | Type | Null | Default |
|---|---|---|---|
| `character_id` | uuid | NO | — |
| `capability_id` | uuid | NO | — |
| `acquired_at_level` | integer | NO | 1 |
| `notes` | text | YES | — |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

**Indexes:**

- `character_capabilities_capability_id_idx` — CREATE INDEX character_capabilities_capability_id_idx ON public.character_capabilities USING btree (capability_id)
- `character_capabilities_character_id_idx` — CREATE INDEX character_capabilities_character_id_idx ON public.character_capabilities USING btree (character_id)
- `character_capabilities_pk` — CREATE UNIQUE INDEX character_capabilities_pk ON public.character_capabilities USING btree (character_id, capability_id)

**Foreign keys:**

- `character_id` → `characters.id` (ON DELETE CASCADE)
- `capability_id` → `capabilities.id` (ON DELETE RESTRICT)

**Primary keys:**

- `character_capabilities_pk`: PRIMARY KEY (character_id, capability_id)

## `character_items`

| Column | Type | Null | Default |
|---|---|---|---|
| `character_id` | uuid | NO | — |
| `item_id` | uuid | NO | — |
| `quantity` | integer | NO | 1 |
| `equipped` | boolean | NO | false |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

**Indexes:**

- `character_items_character_id_idx` — CREATE INDEX character_items_character_id_idx ON public.character_items USING btree (character_id)
- `character_items_item_id_idx` — CREATE INDEX character_items_item_id_idx ON public.character_items USING btree (item_id)
- `character_items_pk` — CREATE UNIQUE INDEX character_items_pk ON public.character_items USING btree (character_id, item_id)

**Foreign keys:**

- `character_id` → `characters.id` (ON DELETE CASCADE)
- `item_id` → `items.id` (ON DELETE RESTRICT)

**Primary keys:**

- `character_items_pk`: PRIMARY KEY (character_id, item_id)

## `character_primitives`

| Column | Type | Null | Default |
|---|---|---|---|
| `character_id` | uuid | NO | — |
| `primitive_id` | integer | NO | — |
| `source` | USER-DEFINED | NO | 'PERSONAL'::character_primitive_source |
| `acquired_at_level` | integer | NO | 1 |
| `notes` | text | YES | — |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |
| `is_mirrored` | boolean | NO | false |

**Indexes:**

- `character_primitives_character_id_idx` — CREATE INDEX character_primitives_character_id_idx ON public.character_primitives USING btree (character_id)
- `character_primitives_pk` — CREATE UNIQUE INDEX character_primitives_pk ON public.character_primitives USING btree (character_id, primitive_id)
- `character_primitives_primitive_id_idx` — CREATE INDEX character_primitives_primitive_id_idx ON public.character_primitives USING btree (primitive_id)

**Foreign keys:**

- `character_id` → `characters.id` (ON DELETE CASCADE)
- `primitive_id` → `primitives.id` (ON DELETE RESTRICT)

**Primary keys:**

- `character_primitives_pk`: PRIMARY KEY (character_id, primitive_id)

## `character_versions`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | NO | gen_random_uuid() |
| `character_id` | uuid | NO | — |
| `version_number` | integer | NO | — |
| `is_latest` | boolean | NO | false |
| `delta_kind` | USER-DEFINED | NO | — |
| `snapshot` | jsonb | NO | — |
| `published_by_user_id` | uuid | YES | — |
| `published_at` | timestamp with time zone | NO | now() |
| `superseded_at` | timestamp with time zone | YES | — |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

**Indexes:**

- `character_versions_pkey` — CREATE UNIQUE INDEX character_versions_pkey ON public.character_versions USING btree (id)

**Primary keys:**

- `character_versions_pkey`: PRIMARY KEY (id)

## `characters`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | NO | gen_random_uuid() |
| `user_id` | text | YES | — |
| `name` | text | NO | — |
| `size` | USER-DEFINED | NO | 'MEDIUM'::character_size |
| `race_name` | text | YES | — |
| `race_image_url` | text | YES | — |
| `race_description` | text | YES | — |
| `background_name` | text | YES | — |
| `background_image_url` | text | YES | — |
| `background_description` | text | YES | — |
| `archetype_name` | text | YES | — |
| `level` | integer | NO | 1 |
| `attr_physical` | integer | NO | 0 |
| `attr_mental` | integer | NO | 0 |
| `attr_magical` | integer | NO | 0 |
| `attr_proficient` | USER-DEFINED | YES | — |
| `practice_slices` | jsonb | NO | '{}'::jsonb |
| `current_vitality` | integer | YES | — |
| `starting_bu` | integer | NO | 25 |
| `bu_spent` | integer | NO | 0 |
| `dm_bonus_bu` | integer | NO | 0 |
| `enforce_template_caps` | boolean | NO | false |
| `is_mirrored` | boolean | NO | false |
| `notes` | text | YES | — |
| `dm_notes` | text | YES | — |
| `portrait_url` | text | YES | — |
| `is_public` | boolean | NO | false |
| `source_origin` | text | YES | — |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

**Indexes:**

- `characters_is_public_idx` — CREATE INDEX characters_is_public_idx ON public.characters USING btree (is_public)
- `characters_pkey` — CREATE UNIQUE INDEX characters_pkey ON public.characters USING btree (id)
- `characters_user_id_idx` — CREATE INDEX characters_user_id_idx ON public.characters USING btree (user_id)
- `characters_user_name_idx` — CREATE INDEX characters_user_name_idx ON public.characters USING btree (user_id, name)

**Primary keys:**

- `characters_pkey`: PRIMARY KEY (id)

## `condition_primitives`

| Column | Type | Null | Default |
|---|---|---|---|
| `condition_id` | uuid | NO | — |
| `primitive_id` | integer | NO | — |
| `quantity` | integer | NO | 1 |
| `sort_order` | integer | NO | 0 |
| `notes` | text | YES | — |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

**Indexes:**

- `condition_primitives_condition_id_idx` — CREATE INDEX condition_primitives_condition_id_idx ON public.condition_primitives USING btree (condition_id)
- `condition_primitives_pk` — CREATE UNIQUE INDEX condition_primitives_pk ON public.condition_primitives USING btree (condition_id, primitive_id)
- `condition_primitives_primitive_id_idx` — CREATE INDEX condition_primitives_primitive_id_idx ON public.condition_primitives USING btree (primitive_id)

**Foreign keys:**

- `condition_id` → `conditions.id` (ON DELETE CASCADE)
- `primitive_id` → `primitives.id` (ON DELETE CASCADE)

**Primary keys:**

- `condition_primitives_pk`: PRIMARY KEY (condition_id, primitive_id)

## `conditions`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | NO | gen_random_uuid() |
| `name` | text | NO | — |
| `description` | text | NO | ''::text |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

**Indexes:**

- `conditions_name_unique_idx` — CREATE UNIQUE INDEX conditions_name_unique_idx ON public.conditions USING btree (name)
- `conditions_pkey` — CREATE UNIQUE INDEX conditions_pkey ON public.conditions USING btree (id)

**Primary keys:**

- `conditions_pkey`: PRIMARY KEY (id)

## `effect_conditions`

| Column | Type | Null | Default |
|---|---|---|---|
| `effect_id` | uuid | NO | — |
| `condition_id` | uuid | NO | — |
| `sort_order` | integer | NO | 0 |
| `notes` | text | YES | — |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

**Indexes:**

- `effect_conditions_condition_id_idx` — CREATE INDEX effect_conditions_condition_id_idx ON public.effect_conditions USING btree (condition_id)
- `effect_conditions_effect_id_idx` — CREATE INDEX effect_conditions_effect_id_idx ON public.effect_conditions USING btree (effect_id)
- `effect_conditions_pk` — CREATE UNIQUE INDEX effect_conditions_pk ON public.effect_conditions USING btree (effect_id, condition_id)

**Foreign keys:**

- `effect_id` → `effects.id` (ON DELETE CASCADE)
- `condition_id` → `conditions.id` (ON DELETE CASCADE)

**Primary keys:**

- `effect_conditions_pk`: PRIMARY KEY (effect_id, condition_id)

## `effect_effects`

| Column | Type | Null | Default |
|---|---|---|---|
| `parent_effect_id` | uuid | NO | — |
| `child_effect_id` | uuid | NO | — |
| `sort_order` | integer | NO | 0 |
| `slot_label` | text | YES | — |
| `notes` | text | YES | — |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

**Indexes:**

- `effect_effects_child_idx` — CREATE INDEX effect_effects_child_idx ON public.effect_effects USING btree (child_effect_id)
- `effect_effects_parent_idx` — CREATE INDEX effect_effects_parent_idx ON public.effect_effects USING btree (parent_effect_id)
- `effect_effects_pk` — CREATE UNIQUE INDEX effect_effects_pk ON public.effect_effects USING btree (parent_effect_id, child_effect_id)

**Foreign keys:**

- `parent_effect_id` → `effects.id` (ON DELETE CASCADE)
- `child_effect_id` → `effects.id` (ON DELETE CASCADE)

**Primary keys:**

- `effect_effects_pk`: PRIMARY KEY (parent_effect_id, child_effect_id)

## `effect_primitives`

| Column | Type | Null | Default |
|---|---|---|---|
| `effect_id` | uuid | NO | — |
| `primitive_id` | integer | NO | — |
| `quantity` | integer | NO | 1 |
| `sort_order` | integer | NO | 0 |
| `notes` | text | YES | — |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

**Indexes:**

- `effect_primitives_effect_id_idx` — CREATE INDEX effect_primitives_effect_id_idx ON public.effect_primitives USING btree (effect_id)
- `effect_primitives_pk` — CREATE UNIQUE INDEX effect_primitives_pk ON public.effect_primitives USING btree (effect_id, primitive_id)
- `effect_primitives_primitive_id_idx` — CREATE INDEX effect_primitives_primitive_id_idx ON public.effect_primitives USING btree (primitive_id)

**Foreign keys:**

- `effect_id` → `effects.id` (ON DELETE CASCADE)
- `primitive_id` → `primitives.id` (ON DELETE CASCADE)

**Primary keys:**

- `effect_primitives_pk`: PRIMARY KEY (effect_id, primitive_id)

## `effect_versions`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | NO | gen_random_uuid() |
| `effect_id` | uuid | NO | — |
| `version_number` | integer | NO | — |
| `is_latest` | boolean | NO | false |
| `delta_kind` | USER-DEFINED | NO | — |
| `snapshot` | jsonb | NO | — |
| `published_by_user_id` | uuid | YES | — |
| `published_at` | timestamp with time zone | NO | now() |
| `superseded_at` | timestamp with time zone | YES | — |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

**Indexes:**

- `effect_versions_effect_id_idx` — CREATE INDEX effect_versions_effect_id_idx ON public.effect_versions USING btree (effect_id)
- `effect_versions_id_version_unique_idx` — CREATE UNIQUE INDEX effect_versions_id_version_unique_idx ON public.effect_versions USING btree (effect_id, version_number)
- `effect_versions_is_latest_idx` — CREATE INDEX effect_versions_is_latest_idx ON public.effect_versions USING btree (is_latest)
- `effect_versions_pkey` — CREATE UNIQUE INDEX effect_versions_pkey ON public.effect_versions USING btree (id)

**Primary keys:**

- `effect_versions_pkey`: PRIMARY KEY (id)

## `effects`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | NO | gen_random_uuid() |
| `name` | text | NO | — |
| `narrative_description` | text | NO | ''::text |
| `is_public` | boolean | NO | false |
| `source_origin` | text | YES | — |
| `tags` | ARRAY | NO | ARRAY[]::text[] |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |
| `user_id` | text | YES | — |

**Indexes:**

- `effects_is_public_idx` — CREATE INDEX effects_is_public_idx ON public.effects USING btree (is_public)
- `effects_name_source_origin_unique_idx` — CREATE UNIQUE INDEX effects_name_source_origin_unique_idx ON public.effects USING btree (name, source_origin)
- `effects_pkey` — CREATE UNIQUE INDEX effects_pkey ON public.effects USING btree (id)
- `effects_tags_idx` — CREATE INDEX effects_tags_idx ON public.effects USING gin (tags)
- `effects_user_id_idx` — CREATE INDEX effects_user_id_idx ON public.effects USING btree (user_id)

**Primary keys:**

- `effects_pkey`: PRIMARY KEY (id)

## `entities`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | NO | gen_random_uuid() |
| `user_id` | text | YES | — |
| `name` | text | NO | — |
| `entity_type` | USER-DEFINED | NO | — |
| `level` | integer | NO | 1 |
| `cumulative_bu_budget` | integer | NO | 0 |
| `current_vitality` | integer | NO | 0 |
| `physical` | integer | NO | 0 |
| `mental` | integer | NO | 0 |
| `magical` | integer | NO | 0 |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

**Indexes:**

- `entities_entity_type_idx` — CREATE INDEX entities_entity_type_idx ON public.entities USING btree (entity_type)
- `entities_pkey` — CREATE UNIQUE INDEX entities_pkey ON public.entities USING btree (id)
- `entities_user_id_idx` — CREATE INDEX entities_user_id_idx ON public.entities USING btree (user_id)
- `entities_user_type_idx` — CREATE INDEX entities_user_type_idx ON public.entities USING btree (user_id, entity_type)

**Primary keys:**

- `entities_pkey`: PRIMARY KEY (id)

## `entity_capabilities`

| Column | Type | Null | Default |
|---|---|---|---|
| `entity_id` | uuid | NO | — |
| `capability_id` | uuid | NO | — |
| `is_active` | boolean | NO | true |
| `loadout_slot` | text | YES | — |
| `sort_order` | integer | NO | 0 |
| `notes` | text | YES | — |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

**Indexes:**

- `entity_capabilities_capability_id_idx` — CREATE INDEX entity_capabilities_capability_id_idx ON public.entity_capabilities USING btree (capability_id)
- `entity_capabilities_entity_id_idx` — CREATE INDEX entity_capabilities_entity_id_idx ON public.entity_capabilities USING btree (entity_id)
- `entity_capabilities_pk` — CREATE UNIQUE INDEX entity_capabilities_pk ON public.entity_capabilities USING btree (entity_id, capability_id)

**Foreign keys:**

- `entity_id` → `entities.id` (ON DELETE CASCADE)
- `capability_id` → `capabilities.id` (ON DELETE CASCADE)

**Primary keys:**

- `entity_capabilities_pk`: PRIMARY KEY (entity_id, capability_id)

## `entity_inventory`

| Column | Type | Null | Default |
|---|---|---|---|
| `entity_id` | uuid | NO | — |
| `item_id` | uuid | NO | — |
| `quantity` | integer | NO | 1 |
| `is_equipped` | boolean | NO | false |
| `equipped_slot` | text | YES | — |
| `notes` | text | YES | — |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

**Indexes:**

- `entity_inventory_entity_id_idx` — CREATE INDEX entity_inventory_entity_id_idx ON public.entity_inventory USING btree (entity_id)
- `entity_inventory_equipped_idx` — CREATE INDEX entity_inventory_equipped_idx ON public.entity_inventory USING btree (is_equipped)
- `entity_inventory_item_id_idx` — CREATE INDEX entity_inventory_item_id_idx ON public.entity_inventory USING btree (item_id)
- `entity_inventory_pk` — CREATE UNIQUE INDEX entity_inventory_pk ON public.entity_inventory USING btree (entity_id, item_id)

**Foreign keys:**

- `entity_id` → `entities.id` (ON DELETE CASCADE)
- `item_id` → `items.id` (ON DELETE CASCADE)

**Primary keys:**

- `entity_inventory_pk`: PRIMARY KEY (entity_id, item_id)

## `entity_primitives`

| Column | Type | Null | Default |
|---|---|---|---|
| `entity_id` | uuid | NO | — |
| `primitive_id` | integer | NO | — |
| `quantity` | integer | NO | 1 |
| `source_label` | text | YES | — |
| `is_permanent` | boolean | NO | true |
| `notes` | text | YES | — |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

**Indexes:**

- `entity_primitives_entity_id_idx` — CREATE INDEX entity_primitives_entity_id_idx ON public.entity_primitives USING btree (entity_id)
- `entity_primitives_pk` — CREATE UNIQUE INDEX entity_primitives_pk ON public.entity_primitives USING btree (entity_id, primitive_id)
- `entity_primitives_primitive_id_idx` — CREATE INDEX entity_primitives_primitive_id_idx ON public.entity_primitives USING btree (primitive_id)

**Foreign keys:**

- `entity_id` → `entities.id` (ON DELETE CASCADE)
- `primitive_id` → `primitives.id` (ON DELETE CASCADE)

**Primary keys:**

- `entity_primitives_pk`: PRIMARY KEY (entity_id, primitive_id)

## `flag_aggregates`

| Column | Type | Null | Default |
|---|---|---|---|
| `target_type` | USER-DEFINED | NO | — |
| `target_id` | text | NO | — |
| `version_id` | uuid | NO | — |
| `unbalanced_count` | integer | NO | 0 |
| `broken_count` | integer | NO | 0 |
| `inappropriate_count` | integer | NO | 0 |
| `duplicate_count` | integer | NO | 0 |
| `other_count` | integer | NO | 0 |
| `updated_at` | timestamp with time zone | NO | now() |

**Indexes:**

- `flag_aggregates_pk` — CREATE UNIQUE INDEX flag_aggregates_pk ON public.flag_aggregates USING btree (target_type, target_id, version_id)

**Primary keys:**

- `flag_aggregates_pk`: PRIMARY KEY (target_type, target_id, version_id)

## `flags`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | NO | gen_random_uuid() |
| `user_id` | uuid | NO | — |
| `target_type` | USER-DEFINED | NO | — |
| `target_id` | text | NO | — |
| `version_id` | uuid | NO | — |
| `reason` | USER-DEFINED | NO | — |
| `note` | text | YES | — |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

**Indexes:**

- `flags_pkey` — CREATE UNIQUE INDEX flags_pkey ON public.flags USING btree (id)

**Primary keys:**

- `flags_pkey`: PRIMARY KEY (id)

## `follows`

| Column | Type | Null | Default |
|---|---|---|---|
| `follower_id` | uuid | NO | — |
| `following_id` | uuid | NO | — |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

## `fork_aggregates`

| Column | Type | Null | Default |
|---|---|---|---|
| `source_target_type` | USER-DEFINED | NO | — |
| `source_target_id` | text | NO | — |
| `source_version_id` | uuid | NO | — |
| `fork_count` | integer | NO | 0 |
| `updated_at` | timestamp with time zone | NO | now() |

**Indexes:**

- `fork_aggregates_pk` — CREATE UNIQUE INDEX fork_aggregates_pk ON public.fork_aggregates USING btree (source_target_type, source_target_id, source_version_id)

**Primary keys:**

- `fork_aggregates_pk`: PRIMARY KEY (source_target_type, source_target_id, source_version_id)

## `forks`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | NO | gen_random_uuid() |
| `forked_by_user_id` | uuid | NO | — |
| `source_target_type` | USER-DEFINED | NO | — |
| `source_target_id` | text | NO | — |
| `source_version_id` | uuid | NO | — |
| `source_author_id` | uuid | YES | — |
| `forked_target_type` | USER-DEFINED | NO | — |
| `forked_target_id` | text | NO | — |
| `forked_version_id` | uuid | NO | — |
| `metadata` | jsonb | YES | — |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

**Indexes:**

- `forks_pkey` — CREATE UNIQUE INDEX forks_pkey ON public.forks USING btree (id)

**Primary keys:**

- `forks_pkey`: PRIMARY KEY (id)

## `item_capabilities`

| Column | Type | Null | Default |
|---|---|---|---|
| `item_id` | uuid | NO | — |
| `capability_id` | uuid | NO | — |
| `sort_order` | integer | NO | 0 |
| `slot_label` | text | YES | — |
| `notes` | text | YES | — |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

**Indexes:**

- `item_capabilities_capability_id_idx` — CREATE INDEX item_capabilities_capability_id_idx ON public.item_capabilities USING btree (capability_id)
- `item_capabilities_item_id_idx` — CREATE INDEX item_capabilities_item_id_idx ON public.item_capabilities USING btree (item_id)
- `item_capabilities_pk` — CREATE UNIQUE INDEX item_capabilities_pk ON public.item_capabilities USING btree (item_id, capability_id)

**Foreign keys:**

- `item_id` → `items.id` (ON DELETE CASCADE)
- `capability_id` → `capabilities.id` (ON DELETE CASCADE)

**Primary keys:**

- `item_capabilities_pk`: PRIMARY KEY (item_id, capability_id)

## `item_effects`

| Column | Type | Null | Default |
|---|---|---|---|
| `item_id` | uuid | NO | — |
| `effect_id` | uuid | NO | — |
| `sort_order` | integer | NO | 0 |
| `slot_label` | text | YES | — |
| `notes` | text | YES | — |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

**Indexes:**

- `item_effects_effect_id_idx` — CREATE INDEX item_effects_effect_id_idx ON public.item_effects USING btree (effect_id)
- `item_effects_item_id_idx` — CREATE INDEX item_effects_item_id_idx ON public.item_effects USING btree (item_id)
- `item_effects_pk` — CREATE UNIQUE INDEX item_effects_pk ON public.item_effects USING btree (item_id, effect_id)

**Foreign keys:**

- `item_id` → `items.id` (ON DELETE CASCADE)
- `effect_id` → `effects.id` (ON DELETE CASCADE)

**Primary keys:**

- `item_effects_pk`: PRIMARY KEY (item_id, effect_id)

## `item_primitives`

| Column | Type | Null | Default |
|---|---|---|---|
| `item_id` | uuid | NO | — |
| `primitive_id` | integer | NO | — |
| `sort_order` | integer | NO | 0 |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

**Indexes:**

- `item_primitives_item_id_idx` — CREATE INDEX item_primitives_item_id_idx ON public.item_primitives USING btree (item_id)
- `item_primitives_pk` — CREATE UNIQUE INDEX item_primitives_pk ON public.item_primitives USING btree (item_id, primitive_id)
- `item_primitives_primitive_id_idx` — CREATE INDEX item_primitives_primitive_id_idx ON public.item_primitives USING btree (primitive_id)

**Foreign keys:**

- `item_id` → `items.id` (ON DELETE CASCADE)
- `primitive_id` → `primitives.id` (ON DELETE RESTRICT)

**Primary keys:**

- `item_primitives_pk`: PRIMARY KEY (item_id, primitive_id)

## `item_versions`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | NO | gen_random_uuid() |
| `item_id` | uuid | NO | — |
| `version_number` | integer | NO | — |
| `is_latest` | boolean | NO | false |
| `delta_kind` | USER-DEFINED | NO | — |
| `snapshot` | jsonb | NO | — |
| `published_by_user_id` | uuid | YES | — |
| `published_at` | timestamp with time zone | NO | now() |
| `superseded_at` | timestamp with time zone | YES | — |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

**Indexes:**

- `item_versions_id_version_unique_idx` — CREATE UNIQUE INDEX item_versions_id_version_unique_idx ON public.item_versions USING btree (item_id, version_number)
- `item_versions_is_latest_idx` — CREATE INDEX item_versions_is_latest_idx ON public.item_versions USING btree (is_latest)
- `item_versions_item_id_idx` — CREATE INDEX item_versions_item_id_idx ON public.item_versions USING btree (item_id)
- `item_versions_pkey` — CREATE UNIQUE INDEX item_versions_pkey ON public.item_versions USING btree (id)

**Primary keys:**

- `item_versions_pkey`: PRIMARY KEY (id)

## `items`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | NO | gen_random_uuid() |
| `name` | text | NO | — |
| `item_type` | USER-DEFINED | NO | — |
| `rarity` | USER-DEFINED | NO | 'COMMON'::item_rarity |
| `bu_cost` | integer | NO | 0 |
| `description` | text | NO | ''::text |
| `slot_cost` | integer | NO | 1 |
| `is_two_handed` | boolean | NO | false |
| `is_consumable` | boolean | NO | false |
| `acts_as_focus` | boolean | NO | true |
| `is_public` | boolean | NO | false |
| `source_origin` | text | YES | — |
| `tags` | ARRAY | NO | ARRAY[]::text[] |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |
| `user_id` | text | YES | — |
| `quantity` | integer | NO | 1 |

**Indexes:**

- `items_is_public_idx` — CREATE INDEX items_is_public_idx ON public.items USING btree (is_public)
- `items_item_type_idx` — CREATE INDEX items_item_type_idx ON public.items USING btree (item_type)
- `items_name_source_origin_unique_idx` — CREATE UNIQUE INDEX items_name_source_origin_unique_idx ON public.items USING btree (name, source_origin)
- `items_pkey` — CREATE UNIQUE INDEX items_pkey ON public.items USING btree (id)
- `items_rarity_idx` — CREATE INDEX items_rarity_idx ON public.items USING btree (rarity)
- `items_tags_idx` — CREATE INDEX items_tags_idx ON public.items USING gin (tags)
- `items_user_id_idx` — CREATE INDEX items_user_id_idx ON public.items USING btree (user_id)

**Primary keys:**

- `items_pkey`: PRIMARY KEY (id)

## `primitive_adoptions`

| Column | Type | Null | Default |
|---|---|---|---|
| `capability_version_id` | uuid | NO | — |
| `primitive_id` | integer | NO | — |
| `primitive_version_id` | uuid | NO | — |
| `is_latest` | boolean | NO | true |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

**Indexes:**

- `primitive_adoptions_pk` — CREATE UNIQUE INDEX primitive_adoptions_pk ON public.primitive_adoptions USING btree (capability_version_id, primitive_id)

**Primary keys:**

- `primitive_adoptions_pk`: PRIMARY KEY (capability_version_id, primitive_id)

## `primitive_versions`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | NO | gen_random_uuid() |
| `primitive_id` | integer | NO | — |
| `version_number` | integer | NO | — |
| `is_latest` | boolean | NO | false |
| `delta_kind` | USER-DEFINED | NO | — |
| `snapshot` | jsonb | NO | — |
| `published_by_user_id` | uuid | YES | — |
| `published_at` | timestamp with time zone | NO | now() |
| `superseded_at` | timestamp with time zone | YES | — |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

**Indexes:**

- `primitive_versions_pkey` — CREATE UNIQUE INDEX primitive_versions_pkey ON public.primitive_versions USING btree (id)

**Primary keys:**

- `primitive_versions_pkey`: PRIMARY KEY (id)

## `primitives`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | integer | NO | nextval('primitives_id_seq'::regclass) |
| `name` | text | NO | — |
| `category` | USER-DEFINED | NO | — |
| `bu_cost` | integer | NO | 0 |
| `hard_modifiers` | jsonb | NO | '[]'::jsonb |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |
| `cost_tier` | text | NO | 'Tier 1: Minor (4 BU anchor)'::text |
| `mechanical_output_text` | text | NO | ''::text |
| `narrative_rule` | text | NO | ''::text |
| `is_mirrorable` | boolean | NO | false |
| `mirror_vector` | text | NO | 'STANDARD_ONLY'::text |
| `mirror_bu_credit` | integer | NO | 0 |
| `mirror_eligibility_notes` | text | NO | ''::text |
| `user_id` | text | YES | — |
| `is_public` | boolean | NO | false |

**Indexes:**

- `primitives_category_idx` — CREATE INDEX primitives_category_idx ON public.primitives USING btree (category)
- `primitives_is_public_idx` — CREATE INDEX primitives_is_public_idx ON public.primitives USING btree (is_public)
- `primitives_name_category_user_unique_idx` — CREATE UNIQUE INDEX primitives_name_category_user_unique_idx ON public.primitives USING btree (name, category, user_id)
- `primitives_pkey` — CREATE UNIQUE INDEX primitives_pkey ON public.primitives USING btree (id)
- `primitives_user_id_idx` — CREATE INDEX primitives_user_id_idx ON public.primitives USING btree (user_id)

**Primary keys:**

- `primitives_pkey`: PRIMARY KEY (id)

## `publications`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | NO | gen_random_uuid() |
| `target_type` | USER-DEFINED | NO | — |
| `target_id` | text | NO | — |
| `version_id` | uuid | NO | — |
| `version_number` | integer | NO | — |
| `author_id` | uuid | YES | — |
| `visibility` | USER-DEFINED | NO | 'PUBLIC'::publish_visibility |
| `published_at` | timestamp with time zone | NO | now() |
| `unpublished_at` | timestamp with time zone | YES | — |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

**Indexes:**

- `publications_pkey` — CREATE UNIQUE INDEX publications_pkey ON public.publications USING btree (id)

**Primary keys:**

- `publications_pkey`: PRIMARY KEY (id)

## `reaction_aggregates`

| Column | Type | Null | Default |
|---|---|---|---|
| `target_type` | USER-DEFINED | NO | — |
| `target_id` | text | NO | — |
| `version_id` | uuid | NO | — |
| `likes_count` | integer | NO | 0 |
| `dislikes_count` | integer | NO | 0 |
| `updated_at` | timestamp with time zone | NO | now() |

**Indexes:**

- `reaction_aggregates_pk` — CREATE UNIQUE INDEX reaction_aggregates_pk ON public.reaction_aggregates USING btree (target_type, target_id, version_id)

**Primary keys:**

- `reaction_aggregates_pk`: PRIMARY KEY (target_type, target_id, version_id)

## `reactions`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | NO | gen_random_uuid() |
| `user_id` | uuid | NO | — |
| `target_type` | USER-DEFINED | NO | — |
| `target_id` | text | NO | — |
| `version_id` | uuid | NO | — |
| `kind` | USER-DEFINED | NO | — |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

**Indexes:**

- `reactions_pkey` — CREATE UNIQUE INDEX reactions_pkey ON public.reactions USING btree (id)

**Primary keys:**

- `reactions_pkey`: PRIMARY KEY (id)

## `reserved_usernames`

| Column | Type | Null | Default |
|---|---|---|---|
| `username` | text | NO | — |
| `reason` | text | NO | — |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

**Indexes:**

- `reserved_usernames_pkey` — CREATE UNIQUE INDEX reserved_usernames_pkey ON public.reserved_usernames USING btree (username)

**Primary keys:**

- `reserved_usernames_pkey`: PRIMARY KEY (username)

## `template_capabilities`

| Column | Type | Null | Default |
|---|---|---|---|
| `template_id` | uuid | NO | — |
| `capability_id` | uuid | NO | — |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

**Indexes:**

- `template_capabilities_capability_id_idx` — CREATE INDEX template_capabilities_capability_id_idx ON public.template_capabilities USING btree (capability_id)
- `template_capabilities_pk` — CREATE UNIQUE INDEX template_capabilities_pk ON public.template_capabilities USING btree (template_id, capability_id)
- `template_capabilities_template_id_idx` — CREATE INDEX template_capabilities_template_id_idx ON public.template_capabilities USING btree (template_id)

**Foreign keys:**

- `template_id` → `templates.id` (ON DELETE CASCADE)
- `capability_id` → `capabilities.id` (ON DELETE RESTRICT)

**Primary keys:**

- `template_capabilities_pk`: PRIMARY KEY (template_id, capability_id)

## `template_primitives`

| Column | Type | Null | Default |
|---|---|---|---|
| `template_id` | uuid | NO | — |
| `primitive_id` | integer | NO | — |
| `sort_order` | integer | NO | 0 |
| `notes` | text | YES | — |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

**Indexes:**

- `template_primitives_pk` — CREATE UNIQUE INDEX template_primitives_pk ON public.template_primitives USING btree (template_id, primitive_id)
- `template_primitives_primitive_id_idx` — CREATE INDEX template_primitives_primitive_id_idx ON public.template_primitives USING btree (primitive_id)
- `template_primitives_template_id_idx` — CREATE INDEX template_primitives_template_id_idx ON public.template_primitives USING btree (template_id)

**Foreign keys:**

- `template_id` → `templates.id` (ON DELETE CASCADE)
- `primitive_id` → `primitives.id` (ON DELETE RESTRICT)

**Primary keys:**

- `template_primitives_pk`: PRIMARY KEY (template_id, primitive_id)

## `template_versions`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | NO | gen_random_uuid() |
| `template_id` | uuid | NO | — |
| `version_number` | integer | NO | — |
| `is_latest` | boolean | NO | false |
| `delta_kind` | USER-DEFINED | NO | — |
| `snapshot` | jsonb | NO | — |
| `published_by_user_id` | uuid | YES | — |
| `published_at` | timestamp with time zone | NO | now() |
| `superseded_at` | timestamp with time zone | YES | — |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

**Indexes:**

- `template_versions_pkey` — CREATE UNIQUE INDEX template_versions_pkey ON public.template_versions USING btree (id)

**Primary keys:**

- `template_versions_pkey`: PRIMARY KEY (id)

## `templates`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | NO | gen_random_uuid() |
| `user_id` | text | YES | — |
| `kind` | USER-DEFINED | NO | — |
| `name` | text | NO | — |
| `image_url` | text | YES | — |
| `description` | text | YES | — |
| `suggested_traits` | text | YES | — |
| `is_public` | boolean | NO | false |
| `source_origin` | text | YES | — |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

**Indexes:**

- `templates_is_public_idx` — CREATE INDEX templates_is_public_idx ON public.templates USING btree (is_public)
- `templates_kind_idx` — CREATE INDEX templates_kind_idx ON public.templates USING btree (kind)
- `templates_pkey` — CREATE UNIQUE INDEX templates_pkey ON public.templates USING btree (id)
- `templates_user_id_idx` — CREATE INDEX templates_user_id_idx ON public.templates USING btree (user_id)
- `templates_user_name_kind_unique` — CREATE UNIQUE INDEX templates_user_name_kind_unique ON public.templates USING btree (name, user_id, kind)

**Primary keys:**

- `templates_pkey`: PRIMARY KEY (id)

## `user_stats`

| Column | Type | Null | Default |
|---|---|---|---|
| `user_id` | uuid | NO | — |
| `public_primitives` | integer | NO | 0 |
| `public_capabilities` | integer | NO | 0 |
| `public_characters` | integer | NO | 0 |
| `public_items` | integer | NO | 0 |
| `public_races` | integer | NO | 0 |
| `public_backgrounds` | integer | NO | 0 |
| `public_archetypes` | integer | NO | 0 |
| `total_forks_received` | integer | NO | 0 |
| `total_likes_received` | integer | NO | 0 |
| `total_dislikes_received` | integer | NO | 0 |
| `followers_count` | integer | NO | 0 |
| `following_count` | integer | NO | 0 |
| `updated_at` | timestamp with time zone | NO | now() |
| `total_forks_created` | integer | NO | 0 |

**Indexes:**

- `user_stats_pkey` — CREATE UNIQUE INDEX user_stats_pkey ON public.user_stats USING btree (user_id)

**Primary keys:**

- `user_stats_pkey`: PRIMARY KEY (user_id)

## `username_history`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | NO | gen_random_uuid() |
| `user_id` | uuid | NO | — |
| `old_username` | text | NO | — |
| `new_username` | text | NO | — |
| `changed_at` | timestamp with time zone | NO | now() |

**Indexes:**

- `username_history_pkey` — CREATE UNIQUE INDEX username_history_pkey ON public.username_history USING btree (id)

**Primary keys:**

- `username_history_pkey`: PRIMARY KEY (id)

## `users`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | NO | gen_random_uuid() |
| `clerk_user_id` | text | NO | — |
| `username` | text | NO | — |
| `display_name` | text | YES | — |
| `bio` | text | YES | — |
| `avatar_url` | text | YES | — |
| `social_links` | jsonb | NO | '{}'::jsonb |
| `is_public` | boolean | NO | true |
| `is_anonymized` | boolean | NO | false |
| `deleted_at` | timestamp with time zone | YES | — |
| `purge_after` | timestamp with time zone | YES | — |
| `created_at` | timestamp with time zone | NO | now() |
| `updated_at` | timestamp with time zone | NO | now() |

**Indexes:**

- `users_clerk_user_id_unique` — CREATE UNIQUE INDEX users_clerk_user_id_unique ON public.users USING btree (clerk_user_id)
- `users_pkey` — CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id)

**Primary keys:**

- `users_pkey`: PRIMARY KEY (id)

