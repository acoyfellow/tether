import type { Command, Update } from "foldkit";
import { modifyFields } from "foldkit/struct";
import { RunCheck } from "./command";
import { EXAMPLES } from "./examples";
import { Message } from "./message";
import { type Model, Run } from "./model";

type Return = Update.Return<Model, Message, never>;

const only = (model: Model): Return => ({ model, commands: [] });

const withCommand = (model: Model, command: Command.Command<Message>): Return => ({ model, commands: [command] });

export const update = (model: Model, message: Message): Return =>
  Message.match(message, {
    EditedClaim: ({ value }) => only(modifyFields(model, { claim: () => value, run: () => Run.Idle() })),
    EditedEvidence: ({ value }) => only(modifyFields(model, { evidence: () => value, run: () => Run.Idle() })),
    PickedExample: ({ index }) => {
      const example = EXAMPLES[index];

      return example
        ? only(modifyFields(model, { claim: () => example.claim, evidence: () => example.evidence, run: () => Run.Idle(), focus: () => null }))
        : only(model);
    },
    ClickedCheck: () => withCommand(modifyFields(model, { run: () => Run.Checking(), focus: () => null }), RunCheck({ claim: model.claim, evidence: model.evidence })),
    Checked: ({ result, ms }) => only(modifyFields(model, { run: () => Run.Checked({ result, ms }) })),
    FailedCheck: ({ reason }) => only(modifyFields(model, { run: () => Run.Failed({ reason }) })),
    FocusedLine: ({ id }) => only(modifyFields(model, { focus: () => id })),
    LoadedProof: ({ proof }) => only(modifyFields(model, { proof: () => proof })),
    MissingProof: () => only(model),
  });
