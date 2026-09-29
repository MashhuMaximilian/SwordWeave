import Link from "next/link";


const NODES = [
  {kind:"primitive",name:"Primitives",icon:"delapouite/cube",x:50,y:9,tone:"gold"},
  {kind:"capability",name:"Capabilities",icon:"lorc/rune-sword",x:88,y:37,tone:"teal"},
  {kind:"item",name:"Items",icon:"lorc/knapsack",x:74,y:83,tone:"silver"},
  {kind:"heritage",name:"Heritages",icon:"lorc/dna1",x:26,y:83,tone:"gold"},
  {kind:"effect",name:"Effects",icon:"lorc/fire-shield",x:12,y:37,tone:"copper"},
] as const;

/** An illustrated map of composition, with links to the explanations below. */
export function ArcaneForge() {
  return <figure className="sw-arcane-forge" aria-label="Five kinds of piece around your character">
    <div className="sw-arcane-forge__drawing">
      <svg className="sw-arcane-forge__rings" viewBox="0 0 600 600" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="forge-metal" x1="70" y1="40" x2="550" y2="600" gradientUnits="userSpaceOnUse"><stop stopColor="#604019"/><stop offset=".22" stopColor="#e6bf68"/><stop offset=".29" stopColor="#fff4bd"/><stop offset=".38" stopColor="#8d6023"/><stop offset=".56" stopColor="#d6a658"/><stop offset=".75" stopColor="#ffedb5"/><stop offset="1" stopColor="#715329"/></linearGradient>
          <linearGradient id="forge-teal" x1="0" y1="0" x2="600" y2="600"><stop stopColor="#7df0dc"/><stop offset=".5" stopColor="#164b4c"/><stop offset="1" stopColor="#78d6d0"/></linearGradient>
          <radialGradient id="forge-depth"><stop stopColor="#183d40"/><stop offset=".54" stopColor="#0b222c"/><stop offset="1" stopColor="#060e16"/></radialGradient>
        </defs>
        <circle cx="300" cy="300" r="275" stroke="#8bc4b6" strokeOpacity=".18"/>
        <circle cx="300" cy="300" r="260" stroke="url(#forge-metal)" strokeWidth="1.5"/>
        <circle cx="300" cy="300" r="250" stroke="#efda9d" strokeWidth="8" strokeOpacity=".07"/>
        <circle cx="300" cy="300" r="228" stroke="url(#forge-teal)" strokeWidth="1" strokeDasharray="28 12 3 12"/>
        {Array.from({length:60},(_,i)=><line key={i} x1="300" y1="32" x2="300" y2={i%5===0?49:39} stroke={i%5===0?"#e8c575":"#8d9c8b"} strokeOpacity={i%5===0?.85:.4} transform={`rotate(${i*6} 300 300)`}/>)}
        <path d="M300 76 528 230 442 498 158 498 72 230Z" stroke="url(#forge-metal)" strokeOpacity=".55"/>
        <path d="M300 76 442 498 72 230 528 230 158 498Z" stroke="#51b9b0" strokeOpacity=".2"/>
        <circle cx="300" cy="300" r="164" fill="url(#forge-depth)" stroke="url(#forge-metal)" strokeWidth="8"/>
        <circle cx="300" cy="300" r="154" stroke="#f2d78b" strokeOpacity=".6"/>
        <circle cx="300" cy="300" r="146" stroke="#469f9b" strokeOpacity=".5"/>
        <path d="M169 216a155 155 0 0 1 221-41M431 384a155 155 0 0 1-221 41" stroke="#bfffee" strokeWidth="2" strokeLinecap="round"/>
        {[0,72,144,216,288].map(angle=><g key={angle} transform={`rotate(${angle} 300 300)`}><path d="m300 107 5 10-5 10-5-10Z" fill="#f5d489"/><circle cx="300" cy="135" r="2" fill="#98e4d7"/></g>)}
      </svg>
      <div className="sw-arcane-forge__heart"><span className="sw-arcane-forge__brand" aria-hidden="true"/><span>Your character</span><small>One of a kind.</small></div>
      {NODES.map(node=><Link key={node.kind} className={`sw-forge-node sw-forge-node--${node.tone}`} href={`#piece-${node.kind}`} style={{left:`${node.x}%`,top:`${node.y}%`}}><span><i className="sw-forge-node__metal-icon" aria-hidden="true" style={{maskImage:`url(/api/icons/game/${node.icon})`,WebkitMaskImage:`url(/api/icons/game/${node.icon})`}} /></span><strong>{node.name}</strong></Link>)}
    </div>
    <figcaption><span />Your rules. Your story. Your weave.<span /></figcaption>
  </figure>;
}
