import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PublicNav } from "@/components/home/public-nav";
import { StructuredData } from "@/components/analytics/structured-data";
import { publicPageMetadata } from "@/lib/seo/metadata";
import "../../books/books.css";
import "./tutorial.css";

export const metadata: Metadata = publicPageMetadata("/tutorials/create-a-primitive");

const SECTIONS = [
  ["choose", "Decide what the primitive does"],
  ["identity", "Give it an identity"],
  ["result", "Result: what changes?"],
  ["operation", "Operation: how does it change?"],
  ["value", "Value: by how much?"],
  ["recipient", "Recipient: who receives it?"],
  ["trigger", "Trigger: when does it apply?"],
  ["stacking", "Choose how contributions combine"],
  ["review", "Review, save and try it"],
  ["next", "Build on the example"],
] as const;

export default function PrimitiveTutorialPage() {
  return <div className="sw-public-site sw-rules-page sw-primitive-tutorial">
    <StructuredData path="/tutorials/create-a-primitive" />
    <PublicNav />
    <header className="sw-rules-header">
      <h1>Create your first primitive</h1>
      <p>Follow one rule through the Atelier, from a description to Result, Operation, Value, Recipient and Trigger. Then check what you actually saved.</p>
      <p>This v0.1 alpha walkthrough uses an illustrative +2 attack-roll bonus. Its BU price is a separate agreement with your GM; the number 2 is the bonus, not its price.</p>
      <div className="sw-public-actions"><Link className="sw-cta-primary" href="/atelier?build=primitive">Open the Atelier <ArrowRight aria-hidden="true" /></Link><Link className="sw-public-link" href="/rules#creating">Keep the rules nearby</Link></div>
    </header>
    <div className="sw-primitive-tutorial__layout">
      <nav className="sw-primitive-tutorial__contents" aria-label="Primitive tutorial contents">
        <h2>In this tutorial</h2>
        <ol>{SECTIONS.map(([id, title]) => <li key={id}><a href={`#${id}`}>{title}</a></li>)}</ol>
      </nav>
      <article className="sw-primitive-tutorial__article">
        <section id="choose" aria-labelledby="choose-title">
          <h2 id="choose-title">Decide what the primitive does</h2>
          <p>Start with one clear outcome: <strong>while this primitive is active, add 2 to the character’s attack rolls.</strong> This example changes a tracked number. It does not add damage or grant a new way to reach a target.</p>
          <p>A primitive can also describe a fictional permission without changing a tracked number. In that case, its <strong>Verbose Narrative Rule</strong> can be the complete explanation. Add a mechanical rule when you need a tracked change or a construction permission.</p>
          <p>Owning a primitive and using an action are separate. A character can reuse owned permissions in several actions and capabilities. The scope, resolution and execution cost of an attempt still depend on the situation.</p>
        </section>
        <section id="identity" aria-labelledby="identity-title">
          <h2 id="identity-title">Give it an identity</h2>
          <p>In the Atelier, choose a new <strong>Primitive</strong> and open <strong>Identity</strong>. If another draft is already open, finish or keep that work before starting this example.</p>
          <ol>
            <li>Give the example a name you will recognize, such as <strong>Steady Aim · tutorial</strong>.</li>
            <li>Choose an icon and a Lexicon Category appropriate to the rule. For this numerical example, inspect <strong>Universal Mathematical Modifiers</strong>.</li>
            <li>Review <strong>Cost Tier Bracket</strong> and <strong>Exact BU</strong> with your GM. A bracket is a pricing anchor; this tutorial does not establish the correct purchase price.</li>
            <li>Write the intended behavior in <strong>Verbose Narrative Rule</strong>: “While active, add 2 to the character’s attack rolls. This bonus does not add damage.”</li>
          </ol>
          <p>Now open <strong>Mechanical rule</strong> and choose <strong>Change a number</strong>. That format supplies a starting rule. Review every field even when the starting values already look right.</p>
          <div className="sw-primitive-tutorial__example">
            <h3>The rule we are building</h3>
            <table><caption>Illustrative editor settings, with pricing agreed separately</caption><thead><tr><th scope="col">Result</th><th scope="col">Operation</th><th scope="col">Value</th><th scope="col">Recipient</th><th scope="col">Trigger</th></tr></thead><tbody><tr><td>Attack Roll</td><td>Add</td><td>Fixed number: 2</td><td>Self</td><td>Always</td></tr></tbody></table>
            <p><strong>Read it aloud:</strong> Change Attack Roll by adding 2 for Self. Include it whenever the primitive is active.</p>
          </div>
        </section>
        <section id="result" aria-labelledby="result-title">
          <h2 id="result-title">Result: what changes?</h2>
          <p>Choose <strong>Result</strong>, then <strong>Rolls &amp; checks</strong>. In <strong>Action Roll</strong>, select <strong>Attack Roll</strong>. Choose the named result rather than Any, which is broader than this example.</p>
          <p>The Result identifies the number or permission being changed. It is different from the Value, which supplies what will be added, set or otherwise applied.</p>
          <p>For a bonus to Awareness or Fieldcraft, inspect <strong>Skill / Practice Check</strong> instead. For a movement speed or maximum Vitality, inspect <strong>Character sheet</strong>. Changing the primitive’s name does not change its selected Result.</p>
        </section>
        <section id="operation" aria-labelledby="operation-title">
          <h2 id="operation-title">Operation: how does it change?</h2>
          <p>Choose <strong>Operation</strong> and select <strong>Add</strong>. We are adding a contribution to the attack-roll bonus.</p>
          <p><strong>Set</strong> assigns a value instead. <strong>Multiply</strong> scales a value. <strong>Grant</strong> and <strong>Revoke</strong> concern permissions, states or features. These choices are different rules, even if the Value happens to be the same.</p>
          <p>Watch the generated sentence above the editor. It should still describe the rule you meant to create.</p>
        </section>
        <section id="value" aria-labelledby="value-title">
          <h2 id="value-title">Value: by how much?</h2>
          <p>Choose <strong>Value</strong>, select <strong>Fixed number</strong>, and enter <strong>2</strong>. This is the amount of the bonus. It is neither the primitive’s BU price nor an action’s execution cost.</p>
          <table><caption>Other Value choices answer different questions</caption><thead><tr><th scope="col">Choice</th><th scope="col">Use it when</th></tr></thead><tbody>
            <tr><th scope="row">Sheet value</th><td>The contribution reads a character value, such as Proficiency Bonus, rather than a fixed number.</td></tr>
            <tr><th scope="row">Dice</th><td>The rule needs a rolled value. Check where and how that output is resolved; a die alone does not define a complete attack or healing action.</td></tr>
            <tr><th scope="row">Formula</th><td>The contribution uses an expression. Check the editor’s validation and preview before applying it.</td></tr>
            <tr><th scope="row">State / keyword</th><td>The rule uses a named state or permission, shown in square brackets. A keyword is not a numerical bonus.</td></tr>
            <tr><th scope="row">Custom runtime</th><td>The rule reads a named value supplied during play. Define who supplies it and what it means.</td></tr>
          </tbody></table>
          <p><strong>Keep the distinction visible:</strong> a Result is what changes; a runtime Value reads something used to calculate that change. Naming a runtime value does not make the application detect it automatically.</p>
        </section>
        <section id="recipient" aria-labelledby="recipient-title">
          <h2 id="recipient-title">Recipient: who receives it?</h2>
          <p>Choose <strong>Recipient</strong> and select <strong>Self</strong>. This is the character who owns or uses the rule.</p>
          <p><strong>Target</strong> refers to the creature or object affected by the action. <strong>Scene</strong> refers to the shared environment or encounter state. Those choices do not by themselves grant range, targeting permission, control of another sheet or automatic cross-character updates.</p>
          <p>For this example, the generated sentence should still end with <strong>for Self</strong>.</p>
        </section>
        <section id="trigger" aria-labelledby="trigger-title">
          <h2 id="trigger-title">Trigger: when does it apply?</h2>
          <p>Choose <strong>Trigger</strong> and select <strong>Always</strong>. No condition is stored. The modifier is included while its containing primitive, effect, item or capability is active.</p>
          <p>Always does not mean an inactive or unequipped source must contribute. Check the source’s actual state on the sheet.</p>
          <dl>
            <div><dt>Tracked condition</dt><dd>The engine reads supported sheet, target or scene state. Choose the actual state, comparison and value; combine predicates with AND or OR when needed.</dd></div>
            <div><dt>Declared at table</dt><dd>A player or GM switches on a named situation. Use this when the fiction needs a declaration rather than something the sheet can detect by itself.</dd></div>
          </dl>
          <p>Keep the first example on Always. Once it works, a useful second exercise is to define a condition and confirm both its active and inactive behavior.</p>
        </section>
        <section id="stacking" aria-labelledby="stacking-title">
          <h2 id="stacking-title">Choose how contributions combine</h2>
          <p>Under <strong>Stacking rule → How they combine</strong>, inspect <strong>Stack all</strong> and <strong>Compare all stacking rules</strong>. Stack all keeps contributions and combines them in resolver order; other choices can retain the highest or lowest contribution, limit repeated application, or replace an earlier contribution.</p>
          <p>Choose the policy the rule actually needs. Reusing the same owned acquisition in several compositions is separate from stacking several active contributions. It does not charge the character for that acquisition again.</p>
        </section>
        <section id="review" aria-labelledby="review-title">
          <h2 id="review-title">Review, save and try it</h2>
          <ol>
            <li>Read the complete generated sentence. Check Attack Roll, Add, 2, Self and Always.</li>
            <li>Compare that sentence with the narrative description. Resolve any mismatch before saving.</li>
            <li>Review the live preview. The optional <strong>Full Primitive JSON Preview</strong> lets you inspect the stored rule; you do not need to write JSON to use the editor.</li>
            <li>Open <strong>Publish</strong>. For a practice entry, choose <strong>Private</strong> visibility. Add accurate tags and a source if useful.</li>
            <li>Choose <strong>Save Primitive</strong>. Wait for the saved confirmation. Authoring from inside a character instead uses <strong>Add to draft</strong> or <strong>Update draft</strong>; review that character draft before applying it.</li>
            <li>Open the saved entry again and inspect it. Saving an entry does not automatically give it to every character.</li>
          </ol>
          <p>Try the rule on a character you use for testing, with the agreed BU available. Compare its attack-roll bonus before and after activating the source. A baseline bonus of +5 with only this +2 contribution becomes +7. Turn it off and compare again. If other rules affect the result, inspect them too.</p>
          <p>If the number does not change as expected, check ownership, active/equipped state, Result, Recipient, Trigger and stacking before adding another rule. A numerical bonus still needs an actual action and the table’s agreed resolution.</p>
        </section>
        <section id="next" aria-labelledby="next-title">
          <h2 id="next-title">Build on the example</h2>
          <p>Next, try a single named Practice bonus, a rule that reads a sheet value, or a clearly declared condition. Change one idea at a time and compare its preview with its actual use.</p>
          <p>For construction permissions, inspect formats such as <strong>Domain access</strong>, <strong>Verb access</strong>, <strong>Range</strong> or <strong>Output die</strong>. These define access for composing actions. The other scaling choices discussed at the table are not automatically a list of extra purchases.</p>
          <div className="sw-public-actions"><Link className="sw-cta-primary" href="/atelier?build=primitive">Build your own rule <ArrowRight aria-hidden="true" /></Link><Link className="sw-public-link" href="/creating">One set of primitives, several uses</Link><Link className="sw-public-link" href="/books/players-handbook">Player’s Handbook</Link></div>
          <p>For a question or a confusing result, use <Link href="/contact">Contact</Link> and describe the intended rule and what you observed.</p>
        </section>
      </article>
    </div>
  </div>;
}
