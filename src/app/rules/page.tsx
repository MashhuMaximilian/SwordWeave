import type { Metadata } from 'next';
import { PublicNav } from '@/components/home/public-nav';
import { PlayGuide } from '@/components/rules/play-guide';

export const metadata: Metadata = {
  title: 'Rules & play guide · SwordWeave',
  description: 'Learn SwordWeave: primitives, capabilities, effects, heritages, rolls, combat rhythm, upkeep, damage, and your character sheet.',
};
export default function RulesPage() {
  return <div className="sw-public-site sw-rules-page"><PublicNav /><header className="sw-rules-header"><p className="sw-public-kicker">Learn to play · Your reference at the table</p><h1>Rules & play guide</h1><p>New to roleplaying games? Begin with Your first game, then build a character and follow a shared round. When you need a reminder, search for a rule or open the optional examples and details.</p></header><PlayGuide /></div>;
}
