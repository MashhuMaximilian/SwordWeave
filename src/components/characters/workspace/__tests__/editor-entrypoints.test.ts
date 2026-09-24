import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BuildModeBanner } from "../../build-mode-banner";
import { openCharacterEditor, parseCharacterEditorIntent } from "../editor-events";
afterEach(()=>vi.unstubAllGlobals());
describe("character workshop entrypoints",()=>{
  it("does not expose an editor to a viewer even if the owner left BUILD mode active",()=>{
    expect(renderToStaticMarkup(createElement(BuildModeBanner,{characterId:"one",initialMode:"BUILD",permission:"VIEWER"}))).toBe("");
  });
  it("defaults missing permissions to read only",()=>{
    expect(renderToStaticMarkup(createElement(BuildModeBanner,{characterId:"one",initialMode:"PLAY"}))).toBe("");
  });
  it("gives a suggester a proposal entry rather than direct editing",()=>{
    const html=renderToStaticMarkup(createElement(BuildModeBanner,{characterId:"one",initialMode:"PLAY",permission:"SUGGESTER"}));
    expect(html).toContain("Suggest changes");
  });
  it("scopes editor requests to the intended character",()=>{
    const dispatchEvent=vi.fn();vi.stubGlobal("window",{dispatchEvent});
    openCharacterEditor("character-2","backstory");
    const event=dispatchEvent.mock.calls[0]![0] as CustomEvent;
    expect(event.type).toBe("sw-character-open-editor");
    expect(event.detail).toEqual({characterId:"character-2",intent:"backstory"});
  });
  it("ignores arbitrary URL intents",()=>{expect(parseCharacterEditorIntent("delete-everything")).toBe("overview");expect(parseCharacterEditorIntent("foundation")).toBe("foundation");});
});
