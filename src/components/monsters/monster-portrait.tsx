import {IconDisplay} from "@/components/icons/icon-display";
import {EntityTypeIcon} from "@/components/icons/entity-type-icon";

/** Keep catalogue portraits in the same icon slot and metallic rim. */
export function MonsterPortrait({imageUrl,name,size=32}:{imageUrl?:string|null|undefined;name?:string|undefined;size?:number}) {
 return imageUrl ? <IconDisplay iconSource="UPLOAD" iconUrl={imageUrl} alt={name?`${name} portrait`:"Creature portrait"} size={size} className="rounded-full"/> : <EntityTypeIcon type="MONSTER" size={size}/>;
}
