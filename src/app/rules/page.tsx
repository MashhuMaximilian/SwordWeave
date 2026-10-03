import type { Metadata } from 'next';
import { PublicNav } from '@/components/home/public-nav';
import { PlayGuide } from '@/components/rules/play-guide';

export const metadata: Metadata = {
  title: 'Rules & play guide · SwordWeave',
  description: 'Learn SwordWeave: primitives, capabilities, effects, heritages, rolls, combat rhythm, upkeep, damage, and your character sheet.',
};
export default function RulesPage() {
  return <div className="sw-public-site sw-rules-page"><PublicNav /><header className="sw-rules-header"><p className="sw-public-kicker">Your reference at the table</p><h1>Rules & play guide</h1><p>From your first intent to your next creation. Find a rule, read an example, and keep the story moving.</p></header><PlayGuide /></div>;
}
