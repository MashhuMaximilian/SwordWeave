"use client";

import { useState } from "react";
import { ArrowRight, Shield, Sparkles, Wind } from "lucide-react";

const INTENTS = [
  { name: "Forge a path", icon: Sparkles, words: "I shape a crossing from the broken stone.", approach: "Reshape the scene", question: "How much stone, how far across, and for how long?" },
  { name: "Hold it together", icon: Shield, words: "I hold the bridge until everyone is safe.", approach: "Protect the crossing", question: "What can you support, and what happens if you let go?" },
  { name: "Carry them through", icon: Wind, words: "I carry my friends over the chasm on the wind.", approach: "Move the group", question: "How many people, how far, and what stands in your way?" },
] as const;

/** A fictional example, not a pre-priced capability or an automated ruling. */
export function TableIntent() {
  const [selected, setSelected] = useState(0);
  const intent = INTENTS[selected]!;
  const Icon = intent.icon;
  return (
    <div className="sw-intent">
      <div className="sw-intent__top"><span className="sw-public-kicker">A moment at your table</span><span className="sw-intent__live"><i /> In play</span></div>
      <div className="sw-intent__scene"><span>The situation</span><p>The bridge is falling.<br />Your friends are still on it.</p></div>
      <div className="sw-intent__choices" role="group" aria-label="Explore a fictional approach">
        {INTENTS.map((item, index) => { const ChoiceIcon = item.icon; return <button type="button" key={item.name} aria-pressed={selected === index} onClick={() => setSelected(index)}><ChoiceIcon aria-hidden="true" /><span>{item.name}</span></button>; })}
      </div>
      <div className="sw-intent__answer" aria-live="polite" aria-atomic="true">
        <div className="sw-intent__seal"><Icon aria-hidden="true" /></div>
        <span className="sw-public-kicker">{intent.approach}</span>
        <blockquote>“{intent.words}”</blockquote>
        <div className="sw-intent__question"><span>Work it out together</span><p>{intent.question}</p></div>
      </div>
      <div className="sw-intent__foot"><ArrowRight aria-hidden="true" /><span>Use the rules your character owns. Agree on the scope and cost together.</span></div>
    </div>
  );
}
