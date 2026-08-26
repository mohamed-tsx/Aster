import { describe, it, expect } from "vitest";
import { AppError } from "../../Src/Utils/ErrorHandler/errorHandler.js";
import { listCaseNotes, createCaseNote } from "../../Src/Services/CaseNotes/caseNotesService.js";
import { createUser, createCase } from "../helpers/factories.js";

describe("createCaseNote", () => {
  it("creates a note authored by the given user", async () => {
    const user = await createUser();
    const kase = await createCase();

    const note = await createCaseNote(kase.id, { body: "Called patient, confirmed travel dates." }, user.id);

    expect(note.body).toBe("Called patient, confirmed travel dates.");
    expect(note.authorId).toBe(user.id);
    expect(note.caseId).toBe(kase.id);
  });

  it("rejects a blank note", async () => {
    const user = await createUser();
    const kase = await createCase();

    await expect(createCaseNote(kase.id, { body: "   " }, user.id)).rejects.toThrow(AppError);
  });

  it("rejects an unknown case", async () => {
    const user = await createUser();

    await expect(
      createCaseNote("does-not-exist", { body: "hello" }, user.id),
    ).rejects.toThrow("Case not found");
  });
});

describe("listCaseNotes", () => {
  it("lists notes newest first, with author info", async () => {
    const user = await createUser();
    const kase = await createCase();

    await createCaseNote(kase.id, { body: "First note" }, user.id);
    await createCaseNote(kase.id, { body: "Second note" }, user.id);

    const notes = await listCaseNotes(kase.id);
    expect(notes).toHaveLength(2);
    expect(notes[0].body).toBe("Second note");
    expect(notes[0].author.id).toBe(user.id);
  });
});
