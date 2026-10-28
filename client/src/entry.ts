import { Runtime } from "foldkit";
import { EXAMPLES } from "./examples";
import { Message } from "./message";
import { Model, Run } from "./model";
import { LoadProof } from "./command";
import { update } from "./update";
import { view } from "./view";

const first = EXAMPLES[0];

const application = Runtime.makeElement({
  Model,
  init: () => ({
    model: { proof: null, claim: first?.claim ?? "", evidence: first?.evidence ?? "", focus: null, run: Run.Idle() },
    commands: [LoadProof({})],
  }),
  update,
  view,
  container: document.getElementById("root"),
  devTools: { Message },
});

Runtime.run(application);
