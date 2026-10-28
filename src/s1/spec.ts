export type ScalarField = {
  readonly type: "number" | "date" | "time" | "datetime";
  readonly instructions: string;
  readonly unit?: string;
  readonly integer?: boolean;
  readonly decimals?: number;
};

export type TextField = { readonly type: "text"; readonly instructions: string };

export type DurationField = {
  readonly type: "duration";
  readonly instructions: string;
  readonly unit: string;
  readonly integer?: boolean;
};

export type ListField = {
  readonly type: "list";
  readonly instructions: string;
  readonly items: "text" | "number" | "date";
};

export type EstimateField = {
  readonly type: "estimate";
  readonly instructions: string;
  readonly unit: string;
  readonly min: number;
  readonly max: number;
  readonly scale?: "linear" | "log";
  readonly step?: number;
};

export type FieldSpec = ScalarField | TextField | DurationField | ListField | EstimateField;

export type ExtractRequest = {
  readonly state: string;
  readonly fields: Readonly<Record<string, FieldSpec>>;
  readonly images?: ReadonlyArray<string>;
  readonly reference_date?: string;
};

export type NoulQuestion = { readonly type: "noul"; readonly instructions: string };

export type ChoiceQuestion = {
  readonly type: "choice";
  readonly instructions: string;
  readonly criteria: Readonly<Record<string, string>>;
};

export type ScoreQuestion = {
  readonly type: "score";
  readonly instructions: string;
  readonly criteria: ReadonlyArray<string>;
};

export type Question = NoulQuestion | ChoiceQuestion | ScoreQuestion;

export type DecideRequest = {
  readonly state: string;
  readonly questions: Readonly<Record<string, Question>>;
};
