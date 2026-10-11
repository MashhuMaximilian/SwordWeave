/** Recognize the scene labels used by System preparations; retain custom prose intact. */
const labels = new Set(['OBJECTIVE', 'TERRAIN', 'OPENING', 'TACTICS', 'OTHER APPROACHES', 'ESCALATION', 'POSSIBLE CONSEQUENCES', 'BUDGET REFERENCE', 'RUNNING THIS EXAMPLE']);
export function encounterBriefing(note: string): { title: string; text: string }[] {
  if (!note.trim()) return [];
  const sections: { title: string; text: string }[] = [];
  for (const block of note.split(/\n\s*\n/)) {
    const [first = '', ...rest] = block.split('\n');
    if (labels.has(first.trim()) && rest.length) sections.push({ title: first.trim().toLowerCase(), text: rest.join('\n') });
    else if (sections.length) sections[sections.length - 1]!.text += '\n\n' + block;
    else sections.push({ title: 'The scene', text: block });
  }
  return sections;
}
